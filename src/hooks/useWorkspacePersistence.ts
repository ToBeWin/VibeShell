import { useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { PaneConfig } from '../components/TerminalGrid';
import { WorkspaceServer } from '../state/workspace';

interface WorkspaceState {
  sessions: Array<{
    server_id: string;
    pane_ids: string[];
    active_pane_id?: string;
  }>;
  active_session_id?: string;
  last_saved: number;
}

interface UseWorkspacePersistenceOptions {
  workspaceSessions: WorkspaceServer[];
  workspacePanes: PaneConfig[];
  activeSessionId: string;
  activePaneId: string;
  onRestore?: (state: WorkspaceState) => void;
}

export function useWorkspacePersistence({
  workspaceSessions,
  workspacePanes,
  activeSessionId,
  activePaneId,
  onRestore,
}: UseWorkspacePersistenceOptions) {
  // Load workspace state on mount
  useEffect(() => {
    const loadWorkspace = async () => {
      try {
        const state = await invoke<WorkspaceState | null>('load_workspace_state');
        if (state && onRestore) {
          onRestore(state);
        }
      } catch (error) {
        console.warn('Failed to load workspace state:', error);
      }
    };

    loadWorkspace();
  }, [onRestore]);

  // Save workspace state (debounced)
  const saveWorkspace = useCallback(async () => {
    try {
      const sessions = workspaceSessions.map(session => {
        const sessionPanes = workspacePanes.filter(
          pane => pane.sessionKey?.startsWith(`session-${session.id}`) || pane.id === `pane-${session.id}`
        );
        const activePaneForSession = sessionPanes.find(pane => pane.id === activePaneId);

        return {
          server_id: session.id,
          pane_ids: sessionPanes.map(p => p.id),
          active_pane_id: activePaneForSession?.id,
        };
      });

      const state: WorkspaceState = {
        sessions,
        active_session_id: activeSessionId,
        last_saved: Date.now(),
      };

      await invoke('save_workspace_state', { workspaceState: state });
    } catch (error) {
      console.warn('Failed to save workspace state:', error);
    }
  }, [workspaceSessions, workspacePanes, activeSessionId, activePaneId]);

  // Auto-save on changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      saveWorkspace();
    }, 1000); // Debounce 1 second

    return () => clearTimeout(timer);
  }, [saveWorkspace]);

  // Save on unmount
  useEffect(() => {
    return () => {
      saveWorkspace();
    };
  }, [saveWorkspace]);

  return {
    saveWorkspace,
  };
}
