import { RemoteFileProtocol, remoteFilesCd, remoteFilesConnect, remoteFilesDelete, remoteFilesDisconnect, remoteFilesDownload, remoteFilesList, remoteFilesMkdir, remoteFilesRead, remoteFilesRename, remoteFilesUpload, remoteFilesWrite } from '../lib/tauri';
import { PaneConfig } from '../components/TerminalGrid';
import { WorkspaceServer } from './workspace';

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

      const owningSession = workspaceSessions.find(
        session => session.host === currentPane.host && session.user === currentPane.user
      );
      const pw = await resolveServerPassword(
        owningSession?.id ?? activeServer.id,
        `Enter password for ${protocol.toUpperCase()} on ${currentPane.user}@${currentPane.host}:`
      );
      if (!pw) {
        setPaneFileLoading(prev => ({ ...prev, [activePaneId]: false }));
        return;
      }

      await remoteFilesConnect(protocol, sid, currentPane.host, defaultPort, currentPane.user, pw);
      setPaneFileSessionId(prev => ({ ...prev, [activePaneId]: sid }));
      const files = await remoteFilesList(protocol, sid);
      setPaneFileList(prev => ({ ...prev, [activePaneId]: files }));
      setPaneFilePath(prev => ({ ...prev, [activePaneId]: '/' }));
    } catch (e) {
      setPaneFileError(prev => ({ ...prev, [activePaneId]: String(e) }));
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
      setPaneFileError(prev => ({ ...prev, [activePaneId]: String(e) }));
    } finally {
      setPaneFileLoading(prev => ({ ...prev, [activePaneId]: false }));
    }
  };

  const closeFilePanel = async () => {
    const fileSessionId = paneFileSessionId[activePaneId];
    const protocol: RemoteFileProtocol = currentFileProtocol;
    if (fileSessionId) {
      await remoteFilesDisconnect(protocol, fileSessionId).catch(console.warn);
      setPaneFileSessionId(prev => ({ ...prev, [activePaneId]: null }));
    }
    setPaneOpenFilePath(prev => ({ ...prev, [activePaneId]: null }));
    setPaneOpenFileContent(prev => ({ ...prev, [activePaneId]: '' }));
    setPaneFileDirty(prev => ({ ...prev, [activePaneId]: false }));
    setSftpOpen(false);
  };

  const setActivePaneFileProtocol = async (protocol: RemoteFileProtocol) => {
    const currentSessionId = paneFileSessionId[activePaneId];
    const previousProtocol = currentFileProtocol;
    if (currentSessionId && previousProtocol !== protocol) {
      await remoteFilesDisconnect(previousProtocol, currentSessionId).catch(console.warn);
    }
    setPaneFileProtocol(prev => ({ ...prev, [activePaneId]: protocol }));
    setPaneFileSessionId(prev => ({ ...prev, [activePaneId]: null }));
    setPaneFileList(prev => ({ ...prev, [activePaneId]: [] }));
    setPaneFilePath(prev => ({ ...prev, [activePaneId]: '/' }));
    setPaneFileError(prev => ({ ...prev, [activePaneId]: '' }));
    setPaneOpenFilePath(prev => ({ ...prev, [activePaneId]: null }));
    setPaneOpenFileContent(prev => ({ ...prev, [activePaneId]: '' }));
    setPaneFileDirty(prev => ({ ...prev, [activePaneId]: false }));
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
      setPaneFileError(prev => ({ ...prev, [activePaneId]: String(e) }));
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
      setPaneFileError(prev => ({ ...prev, [activePaneId]: String(e) }));
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
      setPaneFileError(prev => ({ ...prev, [activePaneId]: String(e) }));
    } finally {
      setPaneFileTransferRunning(prev => ({ ...prev, [activePaneId]: false }));
    }
  };

  const createDirectoryInActivePane = async () => {
    const fileSessionId = paneFileSessionId[activePaneId];
    const protocol: RemoteFileProtocol = currentFileProtocol;
    if (!fileSessionId) return;
    const name = prompt('New directory name:');
    if (!name?.trim()) return;
    setPaneFileTransferRunning(prev => ({ ...prev, [activePaneId]: true }));
    setPaneFileError(prev => ({ ...prev, [activePaneId]: '' }));
    try {
      const remotePath = resolveNextRemoteDirPath(currentFilePath, name.trim());
      await remoteFilesMkdir(protocol, fileSessionId, remotePath);
      await refreshActivePaneRemoteFiles(protocol, fileSessionId);
    } catch (e) {
      setPaneFileError(prev => ({ ...prev, [activePaneId]: String(e) }));
    } finally {
      setPaneFileTransferRunning(prev => ({ ...prev, [activePaneId]: false }));
    }
  };

  const renameRemoteEntryInActivePane = async (entry: string) => {
    const fileSessionId = paneFileSessionId[activePaneId];
    const protocol: RemoteFileProtocol = currentFileProtocol;
    if (!fileSessionId) return;
    const cleanEntry = entry.replace(/\/$/, '');
    const proposed = prompt('Rename remote entry to:', cleanEntry);
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
      setPaneFileError(prev => ({ ...prev, [activePaneId]: String(e) }));
    } finally {
      setPaneFileTransferRunning(prev => ({ ...prev, [activePaneId]: false }));
    }
  };

  const deleteRemoteEntryInActivePane = async (entry: string) => {
    const fileSessionId = paneFileSessionId[activePaneId];
    const protocol: RemoteFileProtocol = currentFileProtocol;
    if (!fileSessionId) return;
    const cleanEntry = entry.replace(/\/$/, '');
    if (!confirm(`Delete remote entry "${cleanEntry}"?`)) return;
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
      setPaneFileError(prev => ({ ...prev, [activePaneId]: String(e) }));
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
