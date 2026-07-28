import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  sendPasswordResetEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from '../lib/firebase';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  role?: string;
  company?: string;
  lastOpenedProjectId?: string;
}

export interface WorkspaceProject {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  createdAt?: string;
}

interface AuthContextType {
  user: FirebaseUser | null;
  userProfile: UserProfile | null;
  projects: WorkspaceProject[];
  activeProjectId: string | null;
  activeProject: WorkspaceProject | null;
  isGuestMode: boolean;
  isLoading: boolean;
  authError: string | null;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (email: string, pass: string, name: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logoutUser: (onBeforeSave?: () => Promise<void>) => Promise<void>;
  switchProject: (projectId: string) => Promise<void>;
  createProject: (name: string, description?: string) => Promise<WorkspaceProject>;
  getIdToken: () => Promise<string | null>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [projects, setProjects] = useState<WorkspaceProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [isGuestMode, setIsGuestMode] = useState<boolean>(!isFirebaseConfigured);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const activeProject = projects.find((p) => p.id === activeProjectId) || projects[0] || null;

  const getIdToken = async (): Promise<string | null> => {
    if (user && isFirebaseConfigured && auth?.currentUser) {
      return await auth.currentUser.getIdToken();
    }
    return null;
  };

  // Sync user profile & projects with backend
  const syncWorkspaceUser = async (idToken?: string | null, firebaseUser?: FirebaseUser | null) => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (idToken) headers['Authorization'] = `Bearer ${idToken}`;

      // Use a timeout so Render cold starts don't block the user forever
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const res = await fetch('/api/workspace/sync-user', {
        method: 'POST',
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        setUserProfile(data.user || null);
        setProjects(data.projects || []);
        setActiveProjectId(data.user?.lastOpenedProjectId || data.projects?.[0]?.id || null);
        setIsGuestMode(data.isGuest || false);
      }
    } catch (err: any) {
      console.warn('Workspace sync note (backend may be cold-starting):', err?.message || err);
      // If backend is unavailable but user IS authenticated via Firebase,
      // still allow them into the app with a basic profile derived from Firebase identity.
      if (firebaseUser) {
        setUserProfile({
          id: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
          avatarUrl: firebaseUser.photoURL || undefined,
        });
        setProjects([]);
        setActiveProjectId(null);
        setIsGuestMode(false);

        // Retry sync once after 8s — by then Render should have woken up
        setTimeout(() => syncWorkspaceUser(idToken, firebaseUser), 8000);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      // Direct Guest Mode Fallback
      setIsGuestMode(true);
      syncWorkspaceUser(null);
      return;
    }

    // Check for redirect result from Google auth
    getRedirectResult(auth).then(async (cred) => {
      if (cred) {
        const token = await cred.user.getIdToken();
        await syncWorkspaceUser(token, cred.user);
      }
    }).catch((err) => console.warn('Redirect result note:', err));

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setUser(fbUser);
      if (fbUser) {
        const token = await fbUser.getIdToken();
        await syncWorkspaceUser(token, fbUser);
      } else {
        setUserProfile(null);
        // Fallback to Guest Mode for demo
        setIsGuestMode(true);
        await syncWorkspaceUser(null, null);
      }
    });

    return () => unsubscribe();
  }, []);

  const loginWithEmail = async (email: string, pass: string) => {
    setAuthError(null);
    setIsLoading(true);
    try {
      if (auth) {
        const cred = await signInWithEmailAndPassword(auth, email, pass);
        const token = await cred.user.getIdToken();
        await syncWorkspaceUser(token, cred.user);
      }
    } catch (err: any) {
      setAuthError(err.message || 'Login failed.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const registerWithEmail = async (email: string, pass: string, name: string) => {
    setAuthError(null);
    setIsLoading(true);
    try {
      if (auth) {
        const cred = await createUserWithEmailAndPassword(auth, email, pass);
        await updateProfile(cred.user, { displayName: name });
        const token = await cred.user.getIdToken(true);
        await syncWorkspaceUser(token, cred.user);
      }
    } catch (err: any) {
      setAuthError(err.message || 'Registration failed.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    setAuthError(null);
    setIsLoading(true);
    try {
      if (auth) {
        try {
          const cred = await signInWithPopup(auth, googleProvider);
          const token = await cred.user.getIdToken();
          await syncWorkspaceUser(token, cred.user);
        } catch (popupErr: any) {
          if (popupErr.code === 'auth/popup-blocked' || popupErr.code === 'auth/popup-closed-by-user' || popupErr.code === 'auth/cancelled-popup-request') {
            await signInWithRedirect(auth, googleProvider);
          } else {
            throw popupErr;
          }
        }
      }
    } catch (err: any) {
      if (err.code === 'auth/unauthorized-domain') {
        setAuthError('Domain unauthorized in Firebase. Please check Firebase Console -> Authentication -> Settings -> Authorized domains.');
      } else {
        setAuthError(err.message || 'Google sign-in failed.');
      }
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    if (auth) {
      await sendPasswordResetEmail(auth, email);
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!auth || !auth.currentUser) {
      throw new Error('No authenticated user session found.');
    }
    if (!auth.currentUser.email) {
      throw new Error('Current user has no associated email address.');
    }

    // Re-authenticate with current credentials for security
    const cred = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
    await reauthenticateWithCredential(auth.currentUser, cred);

    // Update to new password directly in Firebase
    await updatePassword(auth.currentUser, newPassword);
  };

  const logoutUser = async (onBeforeSave?: () => Promise<void>) => {
    // Run pre-save hook BEFORE signing out so token is still valid
    if (onBeforeSave) {
      try { await onBeforeSave(); } catch (e) { console.warn('Pre-logout save note:', e); }
    }
    if (auth) {
      await signOut(auth);
    }
    setUser(null);
    setUserProfile(null);
    setIsGuestMode(false);
  };

  const switchProject = async (projectId: string) => {
    setActiveProjectId(projectId);
    const token = await getIdToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    await fetch('/api/workspace/restore?projectId=' + projectId, { headers });
  };

  const createProject = async (name: string, description?: string): Promise<WorkspaceProject> => {
    const token = await getIdToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/workspace/projects', {
      method: 'POST',
      headers,
      body: JSON.stringify({ name, description }),
    });

    const data = await res.json();
    const newProj = data.project;
    setProjects((prev) => [newProj, ...prev]);
    setActiveProjectId(newProj.id);
    return newProj;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        projects,
        activeProjectId,
        activeProject,
        isGuestMode,
        isLoading,
        authError,
        loginWithEmail,
        registerWithEmail,
        loginWithGoogle,
        resetPassword,
        changePassword,
        logoutUser,
        switchProject,
        createProject,
        getIdToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
