import { HostKeyScanResult } from '../lib/domain';
import { getServerPrivateKey, sshConnect, sshScanHostKey, sshTrustHostKey } from '../lib/tauri';
import { PaneConfig } from '../components/TerminalGrid';
import { findSessionForPane, WorkspaceServer } from './workspace';
import { formatSshConnectionError } from './ssh-errors';
import i18n from '../i18n';

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
  requestSecureInput: (title: string, message: string, defaultValue?: string, confirmLabel?: string) => Promise<string | null>;
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
  requestSecureInput,
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

    const owningSession = findSessionForPane(workspaceSessions, currentPane);
    const serverId = owningSession?.id ?? activeServer.id;
    let privateKey: string | null = null;
    let privateKeyPassphrase: string | null = null;
    try {
      privateKey = await getServerPrivateKey(serverId);
      if (privateKey) {
        privateKeyPassphrase = await requestSecureInput(
          i18n.t('modal.privateKeyPassphraseTitle'),
          i18n.t('modal.privateKeyPassphraseMessage', { user: currentPane.user, host: currentPane.host }),
          '',
          i18n.t('terminal.connect')
        );
        if (privateKeyPassphrase === null) {
          setWorkspacePanes(prev => prev.map(entry => (
            entry.id === currentPane.id ? { ...entry, connecting: false, sessionId: entry.connected ? entry.sessionId : undefined } : entry
          )));
          return;
        }
      }
    } catch {}

    let pw = '';
    if (!privateKey) {
      const resolved = await resolveServerPassword(
        serverId,
        i18n.t('modal.serverPasswordMessage', { user: currentPane.user, host: currentPane.host })
      );
      if (resolved === null) {
        setWorkspacePanes(prev => prev.map(entry => (
          entry.id === currentPane.id ? { ...entry, connecting: false, sessionId: entry.connected ? entry.sessionId : undefined } : entry
        )));
        return;
      }
      pw = resolved;
    }

    try {
      await sshConnect(
        sessionId,
        currentPane.host,
        currentPanePort,
        currentPane.user,
        pw,
        privateKey ?? undefined,
        privateKeyPassphrase ?? undefined
      );
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
      setNoticeModal({ title: i18n.t('modal.sshConnectionFailed'), message: formatSshConnectionError(e) });
    }
  };

  const connectPaneById = async (paneId: string) => {
    const pane = workspacePanes.find(entry => entry.id === paneId);
    if (!pane) return;
    const sessionId = pane.sessionKey ?? `session-${pane.host}-${Date.now()}`;
    setWorkspacePanes(prev => prev.map(entry => (
      entry.id === paneId ? { ...entry, connecting: true, sessionId } : entry
    )));
    const owningSession = findSessionForPane(workspaceSessions, pane);
    const panePort = owningSession?.port ?? activeServer.port;
    const trusted = await ensureTrustedHostKey(pane.host, panePort);
    if (!trusted) {
      setWorkspacePanes(prev => prev.map(entry => (
        entry.id === paneId ? { ...entry, connecting: false, sessionId: entry.connected ? entry.sessionId : undefined } : entry
      )));
      return;
    }

    const serverId = owningSession?.id ?? activeServer.id;
    let privateKey: string | null = null;
    let privateKeyPassphrase: string | null = null;
    try {
      privateKey = await getServerPrivateKey(serverId);
      if (privateKey) {
        privateKeyPassphrase = await requestSecureInput(
          i18n.t('modal.privateKeyPassphraseTitle'),
          i18n.t('modal.privateKeyPassphraseMessage', { user: pane.user, host: pane.host }),
          '',
          i18n.t('terminal.connect')
        );
        if (privateKeyPassphrase === null) {
          setWorkspacePanes(prev => prev.map(entry => (
            entry.id === paneId ? { ...entry, connecting: false, sessionId: entry.connected ? entry.sessionId : undefined } : entry
          )));
          return;
        }
      }
    } catch {}

    let pw = '';
    if (!privateKey) {
      const resolved = await resolveServerPassword(
        serverId,
        i18n.t('modal.serverPasswordMessage', { user: pane.user, host: pane.host })
      );
      if (resolved === null) {
        setWorkspacePanes(prev => prev.map(entry => (
          entry.id === paneId ? { ...entry, connecting: false, sessionId: entry.connected ? entry.sessionId : undefined } : entry
        )));
        return;
      }
      pw = resolved;
    }

    try {
      await sshConnect(
        sessionId,
        pane.host,
        panePort,
        pane.user,
        pw,
        privateKey ?? undefined,
        privateKeyPassphrase ?? undefined
      );
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
      setNoticeModal({ title: i18n.t('modal.sshConnectionFailed'), message: formatSshConnectionError(e) });
    }
  };

  return {
    ensureTrustedHostKey,
    resolveHostKeyDecision,
    connectActiveServer,
    connectPaneById,
  };
}
