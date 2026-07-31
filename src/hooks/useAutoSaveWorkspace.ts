import { useEffect, useRef } from 'react';
import { PinnedDashboardItem, Dataset } from '../types';
import { useAuth } from '../context/AuthContext';

const GUEST_STORAGE_KEY = 'insightai_workspace_guest';

export function useAutoSaveWorkspace(
  pinnedItems: PinnedDashboardItem[],
  datasets: Dataset[]
) {
  const { user, activeProjectId, getIdToken, isGuestMode } = useAuth();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const controller = new AbortController();

    const timer = setTimeout(async () => {
      // Guest Mode: persist ONLY when explicitly in Guest Mode with no authenticated user
      if (isGuestMode && !user) {
        try {
          const existingSnap = loadGuestWorkspaceSnapshot() || {};
          const snapshot = {
            savedAt: new Date().toISOString(),
            datasets: (datasets || []).map((d) => ({
              id: d.id,
              name: d.name,
              description: d.description,
              summary: d.summary,
              data: (d.data || []).slice(0, 2000),
              uploadedAt: d.uploadedAt,
              isSample: d.isSample,
            })),
            pinnedCards: pinnedItems || [],
            history: (existingSnap as any).history || (existingSnap as any).queryHistory || [],
          };
          localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(snapshot));
        } catch (e) {
          console.warn('Guest localStorage save note:', e);
        }
        return;
      }

      // Authenticated User Mode: auto-save metadata to backend and user-isolated localStorage key
      if (user && activeProjectId) {
        try {
          const token = await getIdToken();
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (token) headers['Authorization'] = `Bearer ${token}`;

          const datasetsMeta = (datasets || []).map((d) => ({
            id: d.id,
            name: d.name,
            sourceType: d.isSample ? 'sample' : 'csv',
            summary: d.summary,
          }));

          const userStorageKey = `insightai_workspace_user_${user.uid}_${activeProjectId}`;
          localStorage.setItem(userStorageKey, JSON.stringify({
            savedAt: new Date().toISOString(),
            datasets: datasetsMeta,
            pinnedCards: pinnedItems || [],
          }));

          await fetch(`/api/workspace/projects/${activeProjectId}/auto-save`, {
            method: 'POST',
            headers,
            signal: controller.signal,
            body: JSON.stringify({
              pinnedCards: pinnedItems || [],
              layout: { autoSavedAt: new Date().toISOString() },
              datasetsMeta,
            }),
          });
        } catch (err: any) {
          if (err.name !== 'AbortError') {
            console.warn('Auto-save note:', err);
          }
        }
      }
    }, 3000);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [pinnedItems, datasets, activeProjectId, isGuestMode, user]);
}

/** Loads a previously saved guest workspace snapshot from localStorage */
export function loadGuestWorkspaceSnapshot(): { datasets: any[]; pinnedCards: any[]; history?: any[]; savedAt: string } | null {
  try {
    const raw = localStorage.getItem(GUEST_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Clears the guest localStorage snapshot */
export function clearGuestWorkspaceSnapshot() {
  localStorage.removeItem(GUEST_STORAGE_KEY);
}
