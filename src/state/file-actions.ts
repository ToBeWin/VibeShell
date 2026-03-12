import {
  getServerPrivateKey,
  RemoteFileProtocol,
  remoteFilesCd,
  remoteFilesConnect,
  remoteFilesDelete,
  remoteFilesDisconnect,
  remoteFilesDownload,
  remoteFilesList,
  remoteFilesMkdir,
  remoteFilesRead,
  remoteFilesRename,
  remoteFilesUpload,
  remoteFilesWrite
} from '../lib/tauri';
import { PaneConfig } from '../components/TerminalGrid';
import { createDefaultPaneFileSnapshot } from './files';
import { findSessionForPane, WorkspaceServer } from './workspace';
import i18n from '../i18n';

function resolveNextRemoteDirPath(currentPath: string, dir: string): string {
  if (dir === '..') {
    if (!currentPath || currentPath === '/') return '/';
    const trimmed = currentPath.replace(/\/+$/, '');
    const parent = trimmed.slice(0, trimmed.lastIndexOf('/'));
    return parent || '/';
  }

  const normalized = dir.replace(/\/+$/, '');
  if (normalized.startsWith('/')) {
    return normalized || '/';
  }
  if (currentPath === '/' || !currentPath) {
    return `/${normalized}`;
  }
  return `${currentPath.replace(/\/+$/, '')}/${normalized}`;
}

export function formatRemoteFileError(protocol: RemoteFileProtocol, phase: string, error: unknown): string {
  const raw = String(error ?? '').trim();
  const message = raw.replace(/^Error:\s*/i, '');
  const label = protocol.toUpperCase();

  if (!message) {
    return `${label} ${phase} failed.`;
  }

  if (/authentication rejected|login failed|530\b|permission denied/i.test(message)) {
    return `${label} ${phase} failed: authentication was rejected. Check username, password, or key settings.`;
  }

  if (/host key|failed to receive host key/i.test(message)) {
    return `${label} ${phase} failed: host key verification did not complete. Trust the host key and retry.`;
  }

  if (/timed out|timeout/i.test(message)) {
    if (protocol === 'ftp' && phase === 'connection') {
      return 'FTP connection failed: the server did not respond on the FTP service port. Verify that FTP is enabled and the port is reachable.';
    }
    return `${label} ${phase} failed: the server timed out before responding.`;
  }

  if (/connection refused|connection failed|could not resolve|no route to host|network is unreachable/i.test(message)) {
    return `${label} ${phase} failed: could not reach ${phase === 'connection' ? 'the server' : 'the remote service'}.`;
  }

  if (/not found|no such file|550\b/i.test(message)) {
    return `${label} ${phase} failed: the target path was not found.`;
  }

  if (/not valid UTF-8/i.test(message)) {
    return `${label} ${phase} failed: the selected file is not UTF-8 text.`;
  }

  return `${label} ${phase} failed: ${message}`;
}

interface UseRemoteFileActionsOptions {
  activePaneId: string;
  activeServer: WorkspaceServer;
  currentPane: PaneConfig;
  currentPanePort: number;
  workspaceSessions: WorkspaceServer[];
  paneFileSessionId: Record<string, string | null>;
  paneOpenFilePath: Record<string, string | null>;
  paneOpenFileContent: Record<string, string>;
  ensureTrustedHostKey: (host: string, port: number) => Promise<boolean>;
  resolveServerPassword: (serverId: string, promptText: string) => Promise<string | null>;
  requestTextInput: (title: string, message: string, defaultValue?: string, confirmLabel?: string) => Promise<string | null>;
  requestSecureInput: (title: string, message: string, defaultValue?: string, confirmLabel?: string) => Promise<string | null>;
  requestConfirmation: (title: string, message: string, confirmLabel?: string) => Promise<boolean>;
  setSftpOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setPaneFileSessionId: React.Dispatch<React.SetStateAction<Record<string, string | null>>>;
  setPaneFileList: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  setPaneFilePath: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setPaneFileLoading: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setPaneFileError: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setPaneFileProtocol: React.Dispatch<React.SetStateAction<Record<string, RemoteFileProtocol>>>;
  setPaneOpenFilePath: React.Dispatch<React.SetStateAction<Record<string, string | null>>>;
  setPaneOpenFileContent: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setPaneFileDirty: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setPaneFileSaving: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setPaneFileTransferRunning: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  currentFileProtocol: RemoteFileProtocol;
  currentFilePath: string;
}

export function useRemoteFileActions({
  activePaneId,
  activeServer,
  currentPane,
  currentPanePort,
  workspaceSessions,
  paneFileSessionId,
  paneOpenFilePath,
  paneOpenFileContent,
  ensureTrustedHostKey,
  resolveServerPassword,
  requestTextInput,
  requestSecureInput,
  requestConfirmation,
  setSftpOpen,
  setPaneFileSessionId,
  setPaneFileList,
  setPaneFilePath,
  setPaneFileLoading,
  setPaneFileError,
  setPaneFileProtocol,
  setPaneOpenFilePath,
  setPaneOpenFileContent,
  setPaneFileDirty,
  setPaneFileSaving,
  setPaneFileTransferRunning,
  currentFileProtocol,
  currentFilePath,
}: UseRemoteFileActionsOptions) {
  const applyPaneFileSnapshot = (paneId: string, protocol: RemoteFileProtocol) => {
    const snapshot = createDefaultPaneFileSnapshot(protocol);
    setPaneFileSessionId(prev => ({ ...prev, [paneId]: snapshot.sessionId }));
    setPaneFileList(prev => ({ ...prev, [paneId]: snapshot.list }));
    setPaneFilePath(prev => ({ ...prev, [paneId]: snapshot.path }));
    setPaneFileLoading(prev => ({ ...prev, [paneId]: snapshot.loading }));
    setPaneFileError(prev => ({ ...prev, [paneId]: snapshot.error }));
    setPaneFileProtocol(prev => ({ ...prev, [paneId]: snapshot.protocol }));
    setPaneOpenFilePath(prev => ({ ...prev, [paneId]: snapshot.openFilePath }));
    setPaneOpenFileContent(prev => ({ ...prev, [paneId]: snapshot.openFileContent }));
    setPaneFileDirty(prev => ({ ...prev, [paneId]: snapshot.dirty }));
    setPaneFileSaving(prev => ({ ...prev, [paneId]: snapshot.saving }));
    setPaneFileTransferRunning(prev => ({ ...prev, [paneId]: snapshot.transferRunning }));
  };

  const refreshActivePaneRemoteFiles = async (
    protocol: RemoteFileProtocol,
    sessionId: string,
    nextPath?: string
  ) => {
    const files = await remoteFilesList(protocol, sessionId);
    setPaneFileList(prev => ({ ...prev, [activePaneId]: files }));
    if (nextPath) {
      setPaneFilePath(prev => ({ ...prev, [activePaneId]: nextPath }));
    }
  };

  const initRemoteFiles = async () => {
    const protocol: RemoteFileProtocol = currentFileProtocol;
    setPaneFileLoading(prev => ({ ...prev, [activePaneId]: true }));
    setPaneFileError(prev => ({ ...prev, [activePaneId]: '' }));
    try {
      const sid = `${protocol}-${activePaneId}`;
      const defaultPort = protocol === 'sftp' ? currentPanePort || 22 : 21;
      if (protocol === 'sftp') {
        const trusted = await ensureTrustedHostKey(currentPane.host, defaultPort);
        if (!trusted) {
          setPaneFileLoading(prev => ({ ...prev, [activePaneId]: false }));
          return;
        }
      }

      const owningSession = findSessionForPane(workspaceSessions, currentPane);
      const serverId = owningSession?.id ?? activeServer.id;
      let privateKey: string | null = null;
      let privateKeyPassphrase: string | null = null;
      if (protocol === 'sftp') {
        try {
          privateKey = await getServerPrivateKey(serverId);
          if (privateKey) {
            privateKeyPassphrase = await requestSecureInput(
              i18n.t('modal.privateKeyPassphraseTitle'),
              i18n.t('modal.privateKeyPassphraseMessage', { user: currentPane.user, host: currentPane.host }),
              '',
              i18n.t('modal.serverPasswordConfirm')
            );
            if (privateKeyPassphrase === null) {
              setPaneFileLoading(prev => ({ ...prev, [activePaneId]: false }));
              return;
            }
          }
        } catch {}
      }

      let pw = '';
      if (!privateKey) {
        const resolved = await resolveServerPassword(
          serverId,
          i18n.t('modal.serverPasswordMessage', { user: currentPane.user, host: currentPane.host })
        );
        if (!resolved) {
          setPaneFileLoading(prev => ({ ...prev, [activePaneId]: false }));
          return;
        }
        pw = resolved;
      }

      await remoteFilesConnect(
        protocol,
        sid,
        currentPane.host,
        defaultPort,
        currentPane.user,
        pw,
        privateKey ?? undefined,
        privateKeyPassphrase ?? undefined
      );
      setPaneFileSessionId(prev => ({ ...prev, [activePaneId]: sid }));
      const files = await remoteFilesList(protocol, sid);
      setPaneFileList(prev => ({ ...prev, [activePaneId]: files }));
      setPaneFilePath(prev => ({ ...prev, [activePaneId]: '/' }));
    } catch (e) {
      setPaneFileError(prev => ({ ...prev, [activePaneId]: formatRemoteFileError(protocol, 'connection', e) }));
    } finally {
      setPaneFileLoading(prev => ({ ...prev, [activePaneId]: false }));
    }
  };

  const navRemoteFiles = async (dir: string) => {
    const fileSessionId = paneFileSessionId[activePaneId];
    if (!fileSessionId) return;
    const protocol: RemoteFileProtocol = currentFileProtocol;
    setPaneFileLoading(prev => ({ ...prev, [activePaneId]: true }));
    setPaneFileError(prev => ({ ...prev, [activePaneId]: '' }));
    try {
      if (dir !== '..' && !dir.endsWith('/')) {
        const content = await remoteFilesRead(protocol, fileSessionId, dir);
        const filePath = currentFilePath === '/' ? `/${dir}` : `${currentFilePath.replace(/\/$/, '')}/${dir}`;
        setPaneOpenFilePath(prev => ({ ...prev, [activePaneId]: filePath }));
        setPaneOpenFileContent(prev => ({ ...prev, [activePaneId]: content }));
        setPaneFileDirty(prev => ({ ...prev, [activePaneId]: false }));
        return;
      }

      const targetDir = dir === '..' ? '..' : dir.replace(/\/$/, '');
      await remoteFilesCd(protocol, fileSessionId, targetDir);
      const nextPath = resolveNextRemoteDirPath(currentFilePath, targetDir);
      await refreshActivePaneRemoteFiles(protocol, fileSessionId, nextPath);
      setPaneOpenFilePath(prev => ({ ...prev, [activePaneId]: null }));
      setPaneOpenFileContent(prev => ({ ...prev, [activePaneId]: '' }));
      setPaneFileDirty(prev => ({ ...prev, [activePaneId]: false }));
    } catch (e) {
      setPaneFileError(prev => ({ ...prev, [activePaneId]: formatRemoteFileError(protocol, 'navigation', e) }));
    } finally {
      setPaneFileLoading(prev => ({ ...prev, [activePaneId]: false }));
    }
  };

  const closeFilePanel = async () => {
    const fileSessionId = paneFileSessionId[activePaneId];
    const protocol: RemoteFileProtocol = currentFileProtocol;
    if (fileSessionId) {
      await remoteFilesDisconnect(protocol, fileSessionId).catch(console.warn);
    }
    applyPaneFileSnapshot(activePaneId, protocol);
    setSftpOpen(false);
  };

  const setActivePaneFileProtocol = async (protocol: RemoteFileProtocol) => {
    const currentSessionId = paneFileSessionId[activePaneId];
    const previousProtocol = currentFileProtocol;
    if (currentSessionId && previousProtocol !== protocol) {
      await remoteFilesDisconnect(previousProtocol, currentSessionId).catch(console.warn);
    }
    applyPaneFileSnapshot(activePaneId, protocol);
  };

  const updateActivePaneFileContent = (content: string) => {
    setPaneOpenFileContent(prev => ({ ...prev, [activePaneId]: content }));
    setPaneFileDirty(prev => ({ ...prev, [activePaneId]: true }));
  };

  const saveActivePaneFile = async () => {
    const fileSessionId = paneFileSessionId[activePaneId];
    const protocol: RemoteFileProtocol = currentFileProtocol;
    const path = paneOpenFilePath[activePaneId];
    const content = paneOpenFileContent[activePaneId] ?? '';
    if (!fileSessionId || !path) return;
    setPaneFileSaving(prev => ({ ...prev, [activePaneId]: true }));
    setPaneFileError(prev => ({ ...prev, [activePaneId]: '' }));
    try {
      await remoteFilesWrite(protocol, fileSessionId, path, content);
      setPaneFileDirty(prev => ({ ...prev, [activePaneId]: false }));
    } catch (e) {
      setPaneFileError(prev => ({ ...prev, [activePaneId]: formatRemoteFileError(protocol, 'save', e) }));
    } finally {
      setPaneFileSaving(prev => ({ ...prev, [activePaneId]: false }));
    }
  };

  const uploadFileToActivePane = async (file: File) => {
    const fileSessionId = paneFileSessionId[activePaneId];
    const protocol: RemoteFileProtocol = currentFileProtocol;
    if (!fileSessionId) return;
    setPaneFileTransferRunning(prev => ({ ...prev, [activePaneId]: true }));
    setPaneFileError(prev => ({ ...prev, [activePaneId]: '' }));
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const remotePath = resolveNextRemoteDirPath(currentFilePath, file.name);
      await remoteFilesUpload(protocol, fileSessionId, remotePath, Array.from(bytes));
      await refreshActivePaneRemoteFiles(protocol, fileSessionId);
    } catch (e) {
      setPaneFileError(prev => ({ ...prev, [activePaneId]: formatRemoteFileError(protocol, 'upload', e) }));
    } finally {
      setPaneFileTransferRunning(prev => ({ ...prev, [activePaneId]: false }));
    }
  };

  const downloadActivePaneFile = async () => {
    const fileSessionId = paneFileSessionId[activePaneId];
    const protocol: RemoteFileProtocol = currentFileProtocol;
    const openFilePath = paneOpenFilePath[activePaneId];
    if (!fileSessionId || !openFilePath) return;
    setPaneFileTransferRunning(prev => ({ ...prev, [activePaneId]: true }));
    setPaneFileError(prev => ({ ...prev, [activePaneId]: '' }));
    try {
      const data = await remoteFilesDownload(protocol, fileSessionId, openFilePath);
      const bytes = new Uint8Array(data);
      const blob = new Blob([bytes]);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = openFilePath.split('/').pop() || 'download';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
    } catch (e) {
      setPaneFileError(prev => ({ ...prev, [activePaneId]: formatRemoteFileError(protocol, 'download', e) }));
    } finally {
      setPaneFileTransferRunning(prev => ({ ...prev, [activePaneId]: false }));
    }
  };

  const createDirectoryInActivePane = async () => {
    const fileSessionId = paneFileSessionId[activePaneId];
    const protocol: RemoteFileProtocol = currentFileProtocol;
    if (!fileSessionId) return;
    const name = await requestTextInput(
      i18n.t('fileBrowser.newDirectoryTitle'),
      i18n.t('fileBrowser.newDirectoryMessage'),
      '',
      i18n.t('fileBrowser.create')
    );
    if (!name?.trim()) return;
    setPaneFileTransferRunning(prev => ({ ...prev, [activePaneId]: true }));
    setPaneFileError(prev => ({ ...prev, [activePaneId]: '' }));
    try {
      const remotePath = resolveNextRemoteDirPath(currentFilePath, name.trim());
      await remoteFilesMkdir(protocol, fileSessionId, remotePath);
      await refreshActivePaneRemoteFiles(protocol, fileSessionId);
    } catch (e) {
      setPaneFileError(prev => ({ ...prev, [activePaneId]: formatRemoteFileError(protocol, 'mkdir', e) }));
    } finally {
      setPaneFileTransferRunning(prev => ({ ...prev, [activePaneId]: false }));
    }
  };

  const renameRemoteEntryInActivePane = async (entry: string) => {
    const fileSessionId = paneFileSessionId[activePaneId];
    const protocol: RemoteFileProtocol = currentFileProtocol;
    if (!fileSessionId) return;
    const cleanEntry = entry.replace(/\/$/, '');
    const proposed = await requestTextInput(
      i18n.t('fileBrowser.renameTitle'),
      i18n.t('fileBrowser.renameMessage', { name: cleanEntry }),
      cleanEntry,
      i18n.t('fileBrowser.rename')
    );
    if (!proposed?.trim() || proposed.trim() === cleanEntry) return;
    setPaneFileTransferRunning(prev => ({ ...prev, [activePaneId]: true }));
    setPaneFileError(prev => ({ ...prev, [activePaneId]: '' }));
    try {
      const oldPath = resolveNextRemoteDirPath(currentFilePath, cleanEntry);
      await remoteFilesRename(protocol, fileSessionId, oldPath, proposed.trim());
      await refreshActivePaneRemoteFiles(protocol, fileSessionId);
      if (paneOpenFilePath[activePaneId] === oldPath) {
        setPaneOpenFilePath(prev => ({ ...prev, [activePaneId]: null }));
        setPaneOpenFileContent(prev => ({ ...prev, [activePaneId]: '' }));
        setPaneFileDirty(prev => ({ ...prev, [activePaneId]: false }));
      }
    } catch (e) {
      setPaneFileError(prev => ({ ...prev, [activePaneId]: formatRemoteFileError(protocol, 'rename', e) }));
    } finally {
      setPaneFileTransferRunning(prev => ({ ...prev, [activePaneId]: false }));
    }
  };

  const deleteRemoteEntryInActivePane = async (entry: string) => {
    const fileSessionId = paneFileSessionId[activePaneId];
    const protocol: RemoteFileProtocol = currentFileProtocol;
    if (!fileSessionId) return;
    const cleanEntry = entry.replace(/\/$/, '');
    const confirmed = await requestConfirmation(
      i18n.t('fileBrowser.deleteTitle'),
      i18n.t('fileBrowser.deleteMessage', { name: cleanEntry }),
      i18n.t('fileBrowser.delete')
    );
    if (!confirmed) return;
    setPaneFileTransferRunning(prev => ({ ...prev, [activePaneId]: true }));
    setPaneFileError(prev => ({ ...prev, [activePaneId]: '' }));
    try {
      const targetPath = resolveNextRemoteDirPath(currentFilePath, cleanEntry);
      await remoteFilesDelete(protocol, fileSessionId, targetPath);
      await refreshActivePaneRemoteFiles(protocol, fileSessionId);
      if (paneOpenFilePath[activePaneId] === targetPath) {
        setPaneOpenFilePath(prev => ({ ...prev, [activePaneId]: null }));
        setPaneOpenFileContent(prev => ({ ...prev, [activePaneId]: '' }));
        setPaneFileDirty(prev => ({ ...prev, [activePaneId]: false }));
      }
    } catch (e) {
      setPaneFileError(prev => ({ ...prev, [activePaneId]: formatRemoteFileError(protocol, 'delete', e) }));
    } finally {
      setPaneFileTransferRunning(prev => ({ ...prev, [activePaneId]: false }));
    }
  };

  return {
    initRemoteFiles,
    navRemoteFiles,
    closeFilePanel,
    setActivePaneFileProtocol,
    updateActivePaneFileContent,
    saveActivePaneFile,
    uploadFileToActivePane,
    downloadActivePaneFile,
    createDirectoryInActivePane,
    renameRemoteEntryInActivePane,
    deleteRemoteEntryInActivePane,
  };
}
