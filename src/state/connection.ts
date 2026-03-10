import { HostKeyScanResult } from '../lib/domain';
import { sshConnect, sshScanHostKey, sshTrustHostKey } from '../lib/tauri';
import { PaneConfig } from '../components/TerminalGrid';
import { WorkspaceServer } from './workspace';

interface NoticeState {
  title: string;
  message: string;
}

interface UseConnectionActionsOptions {
  activePaneId: string;
  activeServer: WorkspaceServer;
  currentPane: PaneConfig;
  currentPanePort: number;
  workspaceSessions: WorkspaceServer[];
  workspacePanes: PaneConfig[];
  setPendingHostKeyPrompt: React.Dispatch<React.SetStateAction<{ host: string; port: number; result: HostKeyScanResult } | null>>;
  hostKeyDecisionRef: React.MutableRefObject<((approved: boolean) => void) | null>;
  setNoticeModal: React.Dispatch<React.SetStateAction<NoticeState | null>>;
  resolveServerPassword: (serverId: string, promptText: string) => Promise<string | null>;
  setServers: React.Dispatch<React.SetStateAction<WorkspaceServer[]>>;
  setWorkspaceSessions: React.Dispatch<React.SetStateAction<WorkspaceServer[]>>;
  setWorkspacePanes: React.Dispatch<React.SetStateAction<PaneConfig[]>>;
  setActiveServer: React.Dispatch<React.SetStateAction<WorkspaceServer>>;
}

export function useConnectionActions({
  activePaneId,
  activeServer,
  currentPane,
  currentPanePort,
  workspaceSessions,
  workspacePanes,
  setPendingHostKeyPrompt,
  hostKeyDecisionRef,
  setNoticeModal,
  resolveServerPassword,
  setServers,
  setWorkspaceSessions,
  setWorkspacePanes,
  setActiveServer,
}: UseConnectionActionsOptions) {
  const ensureTrustedHostKey = async (host: string, port: number): Promise<boolean> => {
    const scan = await sshScanHostKey(host, port);
    if (scan.trusted) {
      return true;
    }

    const approved = await new Promise<boolean>((resolve) => {
      hostKeyDecisionRef.current = resolve;
      setPendingHostKeyPrompt({ host, port, result: scan });
    });

    if (!approved) {
      return false;
    }

    await sshTrustHostKey(host, port, scan.record.key_base64);
    return true;
  };

  const resolveHostKeyDecision = (approved: boolean) => {
    setPendingHostKeyPrompt(null);
    hostKeyDecisionRef.current?.(approved);
    hostKeyDecisionRef.current = null;
  };

  const connectActiveServer = async () => {
    const sessionId = currentPane.sessionKey ?? `session-${activeServer.id}`;
    setWorkspacePanes(prev => prev.map(entry => (
      entry.id === currentPane.id ? { ...entry, connecting: true, sessionId } : entry
    )));
    const trusted = await ensureTrustedHostKey(currentPane.host, currentPanePort);
    if (!trusted) {
      setWorkspacePanes(prev => prev.map(entry => (
        entry.id === currentPane.id ? { ...entry, connecting: false, sessionId: entry.connected ? entry.sessionId : undefined } : entry
      )));
      return;
    }

    const owningSession = workspaceSessions.find(
      session => session.host === currentPane.host && session.user === currentPane.user
    );
    const pw = await resolveServerPassword(
      owningSession?.id ?? activeServer.id,
      `Enter password for ${currentPane.user}@${currentPane.host} (leave empty if using SSH Keys):`
    );
    if (pw === null) {
      setWorkspacePanes(prev => prev.map(entry => (
        entry.id === currentPane.id ? { ...entry, connecting: false, sessionId: entry.connected ? entry.sessionId : undefined } : entry
      )));
      return;
    }

    try {
      await sshConnect(sessionId, currentPane.host, currentPanePort, currentPane.user, pw);
      if (owningSession) {
        setServers(prev => prev.map(entry => entry.id === owningSession.id ? { ...entry, connected: true } : entry));
        setWorkspaceSessions(prev => prev.map(entry => entry.id === owningSession.id ? { ...entry, connected: true } : entry));
      }
      setWorkspacePanes(prev => prev.map(entry => (
        entry.id === currentPane.id
          ? { ...entry, connected: true, connecting: false, sessionId, sessionKey: entry.sessionKey ?? sessionId }
          : entry
      )));
      setActiveServer(prev => ({ ...prev, connected: true, host: currentPane.host, user: currentPane.user }));
    } catch (e) {
      setWorkspacePanes(prev => prev.map(entry => (
        entry.id === currentPane.id ? { ...entry, connecting: false, sessionId: entry.connected ? entry.sessionId : undefined } : entry
      )));
      setNoticeModal({ title: 'SSH Connection Failed', message: String(e) });
    }
  };

  const connectPaneById = async (paneId: string) => {
    const pane = workspacePanes.find(entry => entry.id === paneId);
    if (!pane) return;
    const sessionId = pane.sessionKey ?? `session-${pane.host}-${Date.now()}`;
    setWorkspacePanes(prev => prev.map(entry => (
      entry.id === paneId ? { ...entry, connecting: true, sessionId } : entry
    )));
    const owningSession = workspaceSessions.find(session => session.host === pane.host && session.user === pane.user);
    const panePort = owningSession?.port ?? activeServer.port;
    const trusted = await ensureTrustedHostKey(pane.host, panePort);
    if (!trusted) {
      setWorkspacePanes(prev => prev.map(entry => (
        entry.id === paneId ? { ...entry, connecting: false, sessionId: entry.connected ? entry.sessionId : undefined } : entry
      )));
      return;
    }

    const pw = await resolveServerPassword(
      owningSession?.id ?? activeServer.id,
      `Enter password for ${pane.user}@${pane.host} (leave empty if using SSH Keys):`
    );
    if (pw === null) {
      setWorkspacePanes(prev => prev.map(entry => (
        entry.id === paneId ? { ...entry, connecting: false, sessionId: entry.connected ? entry.sessionId : undefined } : entry
      )));
      return;
    }

    try {
      await sshConnect(sessionId, pane.host, panePort, pane.user, pw);
      if (owningSession) {
        setServers(prev => prev.map(entry => entry.id === owningSession.id ? { ...entry, connected: true } : entry));
        setWorkspaceSessions(prev => prev.map(entry => entry.id === owningSession.id ? { ...entry, connected: true } : entry));
      }
      setWorkspacePanes(prev => prev.map(entry => (
        entry.id === paneId
          ? { ...entry, connected: true, connecting: false, sessionId, sessionKey: entry.sessionKey ?? sessionId }
          : entry
      )));
      if (paneId === activePaneId) {
        setActiveServer(prev => ({ ...prev, connected: true, host: pane.host, user: pane.user }));
      }
    } catch (e) {
      setWorkspacePanes(prev => prev.map(entry => (
        entry.id === paneId ? { ...entry, connecting: false, sessionId: entry.connected ? entry.sessionId : undefined } : entry
      )));
      setNoticeModal({ title: 'SSH Connection Failed', message: String(e) });
    }
  };

  return {
    ensureTrustedHostKey,
    resolveHostKeyDecision,
    connectActiveServer,
    connectPaneById,
  };
}
