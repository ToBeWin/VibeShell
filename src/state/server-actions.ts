import { PaneConfig } from '../components/TerminalGrid';
import { sshConnect } from '../lib/tauri';
import { appendServerToWorkspace, ensurePaneForServer, isPaneOwnedByServer, WorkspaceServer } from './workspace';
import { invoke } from '@tauri-apps/api/core';

interface UseServerActionsOptions {
  activePaneId: string;
  servers: WorkspaceServer[];
  workspaceSessions: WorkspaceServer[];
  workspacePanes: PaneConfig[];
  ensureTrustedHostKey: (host: string, port: number) => Promise<boolean>;
  setServers: React.Dispatch<React.SetStateAction<WorkspaceServer[]>>;
  setWorkspaceSessions: React.Dispatch<React.SetStateAction<WorkspaceServer[]>>;
  setWorkspacePanes: React.Dispatch<React.SetStateAction<PaneConfig[]>>;
  setActiveServer: React.Dispatch<React.SetStateAction<WorkspaceServer>>;
  setActiveSessionId: React.Dispatch<React.SetStateAction<string>>;
  setActivePaneId: React.Dispatch<React.SetStateAction<string>>;
}

export function useServerActions({
  activePaneId,
  servers,
  workspaceSessions,
  workspacePanes,
  ensureTrustedHostKey,
  setServers,
  setWorkspaceSessions,
  setWorkspacePanes,
  setActiveServer,
  setActiveSessionId,
  setActivePaneId,
}: UseServerActionsOptions) {
  const handleServerConnected = async (server: WorkspaceServer, password: string) => {
    const targetPane = workspacePanes.find(
      pane => pane.id === activePaneId && pane.host === server.host && pane.user === server.user
    );
    const sessionId = targetPane?.sessionKey ?? `session-${server.id}`;
    setWorkspacePanes(prev => prev.map(entry => (
      entry.id === activePaneId ? { ...entry, connecting: true } : entry
    )));

    try {
      const trusted = await ensureTrustedHostKey(server.host, server.port);
      if (!trusted) {
        setWorkspacePanes(prev => prev.map(entry => (
          entry.id === activePaneId ? { ...entry, connecting: false } : entry
        )));
        return;
      }

      await sshConnect(sessionId, server.host, server.port, server.user, password);
      setServers(prev => prev.map(entry => entry.id === server.id ? { ...entry, connected: true } : entry));
      setWorkspaceSessions(prev => prev.map(entry => entry.id === server.id ? { ...entry, connected: true } : entry));
      setWorkspacePanes(prev => prev.map(entry => (
        entry.id === activePaneId
          ? { ...entry, connected: true, connecting: false, sessionId, sessionKey: entry.sessionKey ?? sessionId }
          : entry
      )));
      setActiveServer({ ...server, connected: true });
    } catch (error) {
      setWorkspacePanes(prev => prev.map(entry => (
        entry.id === activePaneId ? { ...entry, connecting: false } : entry
      )));
      console.warn('SSH connect failed:', error);
    }
  };

  const handleSavedServer = async (server: WorkspaceServer, password: string) => {
    const exists = servers.some(entry => entry.id === server.id);
    setServers(prev => exists ? prev.map(entry => entry.id === server.id ? server : entry) : [...prev, server]);
    setWorkspaceSessions(prev => {
      if (prev.some(entry => entry.id === server.id)) {
        return prev.map(entry => entry.id === server.id ? server : entry);
      }
      return [...prev, server];
    });
    
    // Auto-add new servers to Favorites group
    if (!exists) {
      try {
        await invoke('add_server_to_group', { groupId: 'favorites', serverId: server.id });
      } catch (error) {
        console.warn('Failed to add server to favorites group:', error);
      }
    }
    
    if (exists) {
      setWorkspacePanes(prev => {
        const updated = prev.map(entry => (
          isPaneOwnedByServer(entry, server.id)
            ? {
                ...entry,
                label: `${server.user}@${server.host}`,
                host: server.host,
                user: server.user,
              }
            : entry
        ));
        return ensurePaneForServer(updated, server).panes;
      });
      setActiveServer(server);
      setActiveSessionId(server.id);
      const ensured = ensurePaneForServer(workspacePanes, server);
      setActivePaneId(ensured.pane.id);
    } else {
      const next = appendServerToWorkspace(workspacePanes, server);
      setActiveServer(next.activeServer);
      setActiveSessionId(next.activeSessionId);
      setActivePaneId(next.activePaneId);
      setWorkspacePanes(next.panes);
    }
    if (password || !exists || workspaceSessions.some(entry => entry.id === server.id && entry.connected)) {
      handleServerConnected(server, password);
    }
  };

  return {
    handleServerConnected,
    handleSavedServer,
  };
}
