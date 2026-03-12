import { PaneConfig } from '../components/TerminalGrid';
import { getServerPrivateKey, sshConnect } from '../lib/tauri';
import { appendServerToWorkspace, ensurePaneForServer, isPaneOwnedByServer, WorkspaceServer } from './workspace';
import { invoke } from '@tauri-apps/api/core';
import { formatSshConnectionError } from './ssh-errors';
import i18n from '../i18n';

interface NoticeState {
  title: string;
  message: string;
}

interface UseServerActionsOptions {
  activePaneId: string;
  servers: WorkspaceServer[];
  workspaceSessions: WorkspaceServer[];
  workspacePanes: PaneConfig[];
  ensureTrustedHostKey: (host: string, port: number) => Promise<boolean>;
  requestSecureInput: (title: string, message: string, defaultValue?: string, confirmLabel?: string) => Promise<string | null>;
  setNoticeModal: React.Dispatch<React.SetStateAction<NoticeState | null>>;
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
  requestSecureInput,
  setNoticeModal,
  setServers,
  setWorkspaceSessions,
  setWorkspacePanes,
  setActiveServer,
  setActiveSessionId,
  setActivePaneId,
}: UseServerActionsOptions) {
  const handleServerConnected = async (server: WorkspaceServer, password: string) => {
    const activePane = workspacePanes.find(pane => pane.id === activePaneId);
    const targetPane = activePane && isPaneOwnedByServer(activePane, server.id)
      ? activePane
      : workspacePanes.find(pane => isPaneOwnedByServer(pane, server.id));
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

      let privateKey: string | null = null;
      let privateKeyPassphrase: string | null = null;
      try {
        privateKey = await getServerPrivateKey(server.id);
        if (privateKey) {
          privateKeyPassphrase = await requestSecureInput(
            i18n.t('modal.privateKeyPassphraseTitle'),
            i18n.t('modal.privateKeyPassphraseMessage', { user: server.user, host: server.host }),
            '',
            i18n.t('terminal.connect')
          );
          if (privateKeyPassphrase === null) {
            setWorkspacePanes(prev => prev.map(entry => (
              entry.id === activePaneId ? { ...entry, connecting: false } : entry
            )));
            return;
          }
        }
      } catch {}

      const pw = privateKey ? '' : password;
      await sshConnect(
        sessionId,
        server.host,
        server.port,
        server.user,
        pw,
        privateKey ?? undefined,
        privateKeyPassphrase ?? undefined
      );
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
      setNoticeModal({
        title: i18n.t('modal.sshConnectionFailed'),
        message: formatSshConnectionError(error),
      });
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
