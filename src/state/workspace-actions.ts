import { PaneConfig } from '../components/TerminalGrid';
import { remoteFilesDisconnect, RemoteFileProtocol, sshDisconnect } from '../lib/tauri';
import {
  appendServerToWorkspace,
  ensurePaneForServer,
  createDerivedPane,
  removePaneFromWorkspace,
  selectPaneTargets,
  selectServerTargets,
  selectSessionTargets,
  WorkspaceServer,
} from './workspace';

interface UseWorkspaceActionsOptions {
  activePaneId: string;
  activeServer: WorkspaceServer;
  servers: WorkspaceServer[];
  workspaceSessions: WorkspaceServer[];
  workspacePanes: PaneConfig[];
  paneFileSessionId: Record<string, string | null>;
  paneFileProtocol: Record<string, RemoteFileProtocol>;
  setShowAddServer: React.Dispatch<React.SetStateAction<boolean>>;
  setActiveServer: React.Dispatch<React.SetStateAction<WorkspaceServer>>;
  setActiveSessionId: React.Dispatch<React.SetStateAction<string>>;
  setActivePaneId: React.Dispatch<React.SetStateAction<string>>;
  setWorkspaceSessions: React.Dispatch<React.SetStateAction<WorkspaceServer[]>>;
  setWorkspacePanes: React.Dispatch<React.SetStateAction<PaneConfig[]>>;
  removePaneAiState: (paneId: string) => void;
  removePaneFileState: (paneId: string) => void;
}

export function useWorkspaceActions({
  activePaneId,
  activeServer,
  servers,
  workspaceSessions,
  workspacePanes,
  paneFileSessionId,
  paneFileProtocol,
  setShowAddServer,
  setActiveServer,
  setActiveSessionId,
  setActivePaneId,
  setWorkspaceSessions,
  setWorkspacePanes,
  removePaneAiState,
  removePaneFileState,
}: UseWorkspaceActionsOptions) {
  const addWorkspaceSession = () => {
    const target = servers.find(server => !workspaceSessions.some(session => session.id === server.id));
    if (!target) {
      setShowAddServer(true);
      return;
    }
    setWorkspaceSessions(prev => [...prev, target]);
    const next = appendServerToWorkspace(workspacePanes, target);
    setWorkspacePanes(next.panes);
    setActiveSessionId(next.activeSessionId);
    setActivePaneId(next.activePaneId);
    setActiveServer(next.activeServer);
  };

  const createPaneForActiveSession = () => {
    const sourcePane = workspacePanes.find(pane => pane.id === activePaneId) ?? workspacePanes[0];
    if (!sourcePane) return;
    const nextPane = createDerivedPane(sourcePane, activeServer.id);
    setWorkspacePanes(prev => [...prev, nextPane]);
    setActivePaneId(nextPane.id);
  };

  const removeWorkspacePane = (paneId: string) => {
    const paneToRemove = workspacePanes.find(pane => pane.id === paneId);
    if (workspacePanes.length <= 1) return;

    if (paneToRemove?.sessionId) {
      sshDisconnect(paneToRemove.sessionId).catch(console.warn);
    }

    const fileSessionId = paneFileSessionId[paneId];
    if (fileSessionId) {
      remoteFilesDisconnect(paneFileProtocol[paneId] ?? 'ftp', fileSessionId).catch(console.warn);
    }

    const removal = removePaneFromWorkspace(workspacePanes, workspaceSessions, paneId, activePaneId);
    setWorkspacePanes(removal.panes);

    if (removal.nextActivePane) {
      setActivePaneId(removal.nextActivePane.id);
    }

    if (removal.nextActiveSession) {
      setActiveSessionId(removal.nextActiveSession.id);
      setActiveServer(removal.nextActiveSession);
    }

    removePaneAiState(paneId);
    removePaneFileState(paneId);
  };

  const selectWorkspaceSession = (sessionId: string) => {
    const { pane, session } = selectSessionTargets(workspacePanes, workspaceSessions, sessionId);
    if (session) {
      setActiveSessionId(session.id);
      setActiveServer(session);
      if (!pane) {
        const ensured = ensurePaneForServer(workspacePanes, session);
        setWorkspacePanes(ensured.panes);
        setActivePaneId(ensured.pane.id);
        return;
      }
    }
    if (pane) {
      setActivePaneId(pane.id);
    }
  };

  const selectServerInWorkspace = (server: WorkspaceServer) => {
    setActiveServer(server);
    const { pane, session } = selectServerTargets(workspacePanes, workspaceSessions, server);
    if (pane) {
      setActivePaneId(pane.id);
    } else {
      const ensured = ensurePaneForServer(workspacePanes, server);
      setWorkspacePanes(ensured.panes);
      setActivePaneId(ensured.pane.id);
    }
    if (session) {
      setActiveSessionId(session.id);
    }
  };

  const handleActivePaneChange = (paneId: string) => {
    setActivePaneId(paneId);
    const { session } = selectPaneTargets(workspacePanes, workspaceSessions, paneId);
    if (session) {
      setActiveSessionId(session.id);
      setActiveServer(session);
    }
  };

  return {
    addWorkspaceSession,
    createPaneForActiveSession,
    removeWorkspacePane,
    selectWorkspaceSession,
    selectServerInWorkspace,
    handleActivePaneChange,
  };
}
