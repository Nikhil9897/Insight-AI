import { useEffect, useRef } from 'react';
import { PinnedDashboardItem, Dataset } from '../types';
import { useAuth } from '../context/AuthContext';

const GUEST_STORAGE_KEY = 'insightai_workspace_guest';

export function useAutoSaveWorkspace(
  pinnedItems: PinnedDashboardItem[],
  datasets: Dataset[]
) {
  const { activeProjectId, getIdToken, isGuestMode } = useAuth();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const controller = new AbortController();

    const timer = setTimeout(async () => {
      // Guest Mode: persist to localStorage as fallback
      if (isGuestMode || !activeProjectId) {
        try {
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
          };
          localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(snapshot));
        } catch (e) {
          console.warn('Guest localStorage save note:', e);
        }
        return;
      }

      // Authenticated Mode: auto-save metadata to backend
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
    }, 3000);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [pinnedItems, datasets, activeProjectId, isGuestMode]);
}

/** Loads a previously saved guest workspace snapshot from localStorage */
export function loadGuestWorkspaceSnapshot(): { datasets: any[]; pinnedCards: any[]; savedAt: string } | null {
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
