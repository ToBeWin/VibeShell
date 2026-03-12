import { useEffect, useCallback, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { PaneConfig } from '../components/TerminalGrid';
import { createPaneForServer, createDerivedPane, WorkspaceServer } from '../state/workspace';

interface WorkspaceState {
  sessions: Array<{
    server_id: string;
    pane_ids: string[];
    active_pane_id?: string;
  }>;
  active_session_id?: string;
  last_saved: number;
}

type WorkspacePersistenceHotData = {
  workspaceLoadAttempted?: boolean;
};

function getWorkspacePersistenceHotData(): WorkspacePersistenceHotData | undefined {
  return (import.meta as ImportMeta & { hot?: { data: WorkspacePersistenceHotData } }).hot?.data;
}

interface UseWorkspacePersistenceOptions {
  availableServers: WorkspaceServer[];
  workspaceSessions: WorkspaceServer[];
  workspacePanes: PaneConfig[];
  activeSessionId: string;
  activePaneId: string;
  enabled?: boolean;
  onRestore?: (state: WorkspaceState) => void;
}

export interface RestoredWorkspace {
  sessions: WorkspaceServer[];
  panes: PaneConfig[];
  activeSessionId: string;
  activePaneId: string;
  activeServer: WorkspaceServer | null;
}

export function serializeWorkspaceState(
  workspaceSessions: WorkspaceServer[],
  workspacePanes: PaneConfig[],
  activeSessionId: string,
  activePaneId: string
): WorkspaceState {
  const sessions = workspaceSessions.map(session => {
    const sessionPanes = workspacePanes.filter(
      pane =>
        pane.serverId === session.id ||
        pane.sessionKey?.startsWith(`session-${session.id}`) ||
        pane.id === `pane-${session.id}`
    );
    const activePaneForSession = sessionPanes.find(pane => pane.id === activePaneId);

    return {
      server_id: session.id,
      pane_ids: sessionPanes.map(p => p.id),
      active_pane_id: activePaneForSession?.id,
    };
  });

  return {
    sessions,
    active_session_id: activeSessionId,
    last_saved: Date.now(),
  };
}

export function restoreWorkspaceState(
  state: WorkspaceState,
  availableServers: WorkspaceServer[]
): RestoredWorkspace | null {
  const serverById = new Map(availableServers.map(server => [server.id, server]));
  const sessions = state.sessions
    .map(sessionState => serverById.get(sessionState.server_id))
    .filter((session): session is WorkspaceServer => Boolean(session));

  if (sessions.length === 0) {
    return null;
  }

  const panes = sessions.flatMap(session => {
    const sessionState = state.sessions.find(entry => entry.server_id === session.id);
    const paneIds = sessionState?.pane_ids.length ? sessionState.pane_ids : [`pane-${session.id}`];
    const primary = createPaneForServer(session);

    return paneIds.map((paneId, index) => {
      if (index === 0) {
        return {
          ...primary,
          id: paneId,
        };
      }

      const derived = createDerivedPane(primary, session.id);
      return {
        ...derived,
        id: paneId,
        serverId: session.id,
        sessionKey: `session-${session.id}-${index + 1}`,
      };
    });
  });

  const activeSession =
    sessions.find(session => session.id === state.active_session_id) ??
    sessions[0];
  const activeSessionState = state.sessions.find(entry => entry.server_id === activeSession.id);
  const activePane =
    panes.find(pane => pane.id === activeSessionState?.active_pane_id) ??
    panes.find(pane => pane.serverId === activeSession.id) ??
    panes[0];

  return {
    sessions,
    panes,
    activeSessionId: activeSession.id,
    activePaneId: activePane.id,
    activeServer: activeSession,
  };
}

export function useWorkspacePersistence({
  availableServers,
  workspaceSessions,
  workspacePanes,
  activeSessionId,
  activePaneId,
  enabled = true,
  onRestore,
}: UseWorkspacePersistenceOptions) {
  const [hasLoadedWorkspace, setHasLoadedWorkspace] = useState(false);
  const hasAttemptedLoadRef = useRef(false);
  const onRestoreRef = useRef(onRestore);
  const hmrDisposingRef = useRef(false);

  useEffect(() => {
    const hot = (import.meta as ImportMeta & { hot?: { dispose: (cb: () => void) => void } }).hot;
    if (!hot) {
      return;
    }

    hot.dispose(() => {
      hmrDisposingRef.current = true;
    });
  }, []);

  useEffect(() => {
    onRestoreRef.current = onRestore;
  }, [onRestore]);

  // Load workspace state on mount
  useEffect(() => {
    const hotData = getWorkspacePersistenceHotData();
    if (!enabled || availableServers.length === 0 || hasAttemptedLoadRef.current || hotData?.workspaceLoadAttempted) {
      return;
    }
    hasAttemptedLoadRef.current = true;
    if (hotData) {
      hotData.workspaceLoadAttempted = true;
    }

    let cancelled = false;

    const loadWorkspace = async () => {
      try {
        const state = await invoke<WorkspaceState | null>('load_workspace_state');
        if (!cancelled && state && onRestoreRef.current) {
          onRestoreRef.current(state);
        }
      } catch (error) {
        console.warn('Failed to load workspace state:', error);
      } finally {
        if (!cancelled) {
          setHasLoadedWorkspace(true);
        }
      }
    };

    loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, [enabled, availableServers.length]);

  // Save workspace state (debounced)
  const saveWorkspace = useCallback(async () => {
    if (
      hmrDisposingRef.current ||
      !enabled ||
      !hasLoadedWorkspace ||
      availableServers.length === 0 ||
      workspaceSessions.length === 0
    ) {
      return;
    }

    try {
      const state = serializeWorkspaceState(
        workspaceSessions,
        workspacePanes,
        activeSessionId,
        activePaneId
      );
      await invoke('save_workspace_state', { workspaceState: state });
    } catch (error) {
      console.warn('Failed to save workspace state:', error);
    }
  }, [enabled, hasLoadedWorkspace, availableServers.length, workspaceSessions, workspacePanes, activeSessionId, activePaneId]);

  // Auto-save on changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      saveWorkspace();
    }, 1000); // Debounce 1 second

    return () => clearTimeout(timer);
  }, [saveWorkspace]);

  return {
    saveWorkspace,
  };
}
