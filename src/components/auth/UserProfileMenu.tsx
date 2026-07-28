import React, { useState } from 'react';
import { User, LogOut, ChevronDown, ShieldCheck, Sparkles, FolderGit2, KeyRound, Save, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../ui/Badge';
import { ChangePasswordModal } from './ChangePasswordModal';

interface UserProfileMenuProps {
  onOpenProjectSwitcher?: () => void;
  onOpenAuthModal?: () => void;
  onSignOut?: () => void;
  onSaveProgress?: () => Promise<void>;
}

export const UserProfileMenu: React.FC<UserProfileMenuProps> = ({
  onOpenProjectSwitcher,
  onOpenAuthModal,
  onSignOut,
  onSaveProgress,
}) => {
  const { userProfile, user, isGuestMode, logoutUser, activeProject } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isSavingBeforeLogout, setIsSavingBeforeLogout] = useState(false);

  const rawName = userProfile?.displayName || user?.displayName;
  const email = userProfile?.email || user?.email || (isGuestMode ? 'guest@insightai.demo' : '');
  const displayName = rawName && rawName !== 'Authenticated User' && rawName !== 'User Account'
    ? rawName
    : (email ? email.split('@')[0] : (isGuestMode ? 'Demo / Guest User' : 'Authenticated User'));
  const avatarUrl = userProfile?.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${displayName}`;

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center space-x-2 bg-white hover:bg-slate-50 border border-slate-200/80 p-1.5 pr-3 rounded-2xl shadow-soft-xs transition-all cursor-pointer"
        >
          <img
            src={avatarUrl}
            alt={displayName}
            className="w-7 h-7 rounded-xl object-cover border border-slate-200"
          />
          <div className="text-left hidden sm:block">
            <div className="text-xs font-bold text-slate-900 leading-none">{displayName}</div>
            <div className="text-[10px] font-semibold leading-none mt-1 text-slate-400">
              {isGuestMode ? 'Demo / Guest Session' : 'Supabase Authenticated'}
            </div>
          </div>
          <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200/90 rounded-2xl shadow-soft-xl z-50 py-2 divide-y divide-slate-100 text-xs animate-in fade-in zoom-in-95 duration-150">
            <div className="px-4 py-3 space-y-1">
              <div className="font-extrabold text-slate-900">{displayName}</div>
              <div className="text-[11px] text-slate-500 font-medium truncate">{email}</div>
              <div className="pt-1">
                <Badge variant={isGuestMode ? 'amber' : 'emerald'}>
                  {isGuestMode ? 'Guest Mode (SQLite)' : 'Supabase Authenticated'}
                </Badge>
              </div>
            </div>

            <div className="py-1">
              {activeProject && (
                <div className="px-4 py-2 text-[11px] text-slate-500 flex items-center justify-between">
                  <span className="font-semibold">Active Project:</span>
                  <span className="font-bold text-slate-900 truncate max-w-[110px]">{activeProject.name}</span>
                </div>
              )}

              {onOpenProjectSwitcher && (
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    onOpenProjectSwitcher();
                  }}
                  className="w-full px-4 py-2 text-left font-bold text-slate-700 hover:bg-slate-50 flex items-center space-x-2 transition-colors cursor-pointer"
                >
                  <FolderGit2 className="h-4 w-4 text-blue-600" />
                  <span>Switch / Manage Projects</span>
                </button>
              )}

              {!isGuestMode && (
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    setIsChangePasswordOpen(true);
                  }}
                  className="w-full px-4 py-2 text-left font-bold text-slate-700 hover:bg-slate-50 flex items-center space-x-2 transition-colors cursor-pointer"
                >
                  <KeyRound className="h-4 w-4 text-amber-500" />
                  <span>Change Password</span>
                </button>
              )}
            </div>

            <div className="py-1">
              {isGuestMode && onOpenAuthModal && (
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    onOpenAuthModal();
                  }}
                  className="w-full px-4 py-2.5 text-left font-bold text-blue-600 hover:bg-blue-50 flex items-center space-x-2 transition-colors cursor-pointer"
                >
                  <User className="h-4 w-4 text-blue-600" />
                  <span>Sign In / Create Account</span>
                </button>
              )}

              <button
                onClick={async () => {
                  setDropdownOpen(false);
                  if (onSaveProgress) {
                    setIsSavingBeforeLogout(true);
                    try { await onSaveProgress(); } catch (e) {}
                    setIsSavingBeforeLogout(false);
                  }
                  await logoutUser();
                  if (onSignOut) onSignOut();
                }}
                disabled={isSavingBeforeLogout}
                className="w-full px-4 py-2.5 text-left font-bold text-rose-600 hover:bg-rose-50 flex items-center space-x-2 transition-colors cursor-pointer disabled:opacity-60"
              >
                {isSavingBeforeLogout
                  ? <RefreshCw className="h-4 w-4 text-rose-600 animate-spin" />
                  : <LogOut className="h-4 w-4 text-rose-600" />}
                <span>{isSavingBeforeLogout ? 'Saving...' : isGuestMode ? 'Exit Demo to Landing' : 'Sign Out'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />
    </>
  );
};
