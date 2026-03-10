import { useMemo, useState } from 'react';
import { RemoteFileProtocol } from '../lib/tauri';

export interface PaneFileStateValue {
  paneFileSessionId: Record<string, string | null>;
  setPaneFileSessionId: React.Dispatch<React.SetStateAction<Record<string, string | null>>>;
  paneFileList: Record<string, string[]>;
  setPaneFileList: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  paneFilePath: Record<string, string>;
  setPaneFilePath: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  paneFileLoading: Record<string, boolean>;
  setPaneFileLoading: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  paneFileError: Record<string, string>;
  setPaneFileError: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  paneFileProtocol: Record<string, RemoteFileProtocol>;
  setPaneFileProtocol: React.Dispatch<React.SetStateAction<Record<string, RemoteFileProtocol>>>;
  paneOpenFilePath: Record<string, string | null>;
  setPaneOpenFilePath: React.Dispatch<React.SetStateAction<Record<string, string | null>>>;
  paneOpenFileContent: Record<string, string>;
  setPaneOpenFileContent: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  paneFileDirty: Record<string, boolean>;
  setPaneFileDirty: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  paneFileSaving: Record<string, boolean>;
  setPaneFileSaving: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  paneFileTransferRunning: Record<string, boolean>;
  setPaneFileTransferRunning: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  currentFileSessionId: string | null;
  currentFileList: string[];
  currentFilePath: string;
  currentFileLoading: boolean;
  currentFileError: string;
  currentFileProtocol: RemoteFileProtocol;
  currentOpenFilePath: string | null;
  currentOpenFileContent: string;
  currentFileDirty: boolean;
  currentFileSaving: boolean;
  currentFileTransferRunning: boolean;
  removePaneState: (paneId: string) => void;
}

export function usePaneFileState(activePaneId: string): PaneFileStateValue {
  const [paneFileSessionId, setPaneFileSessionId] = useState<Record<string, string | null>>({});
  const [paneFileList, setPaneFileList] = useState<Record<string, string[]>>({});
  const [paneFilePath, setPaneFilePath] = useState<Record<string, string>>({});
  const [paneFileLoading, setPaneFileLoading] = useState<Record<string, boolean>>({});
  const [paneFileError, setPaneFileError] = useState<Record<string, string>>({});
  const [paneFileProtocol, setPaneFileProtocol] = useState<Record<string, RemoteFileProtocol>>({});
  const [paneOpenFilePath, setPaneOpenFilePath] = useState<Record<string, string | null>>({});
  const [paneOpenFileContent, setPaneOpenFileContent] = useState<Record<string, string>>({});
  const [paneFileDirty, setPaneFileDirty] = useState<Record<string, boolean>>({});
  const [paneFileSaving, setPaneFileSaving] = useState<Record<string, boolean>>({});
  const [paneFileTransferRunning, setPaneFileTransferRunning] = useState<Record<string, boolean>>({});

  const currentFileState = useMemo(
    () => ({
      currentFileSessionId: paneFileSessionId[activePaneId] ?? null,
      currentFileList: paneFileList[activePaneId] ?? [],
      currentFilePath: paneFilePath[activePaneId] ?? '/',
      currentFileLoading: paneFileLoading[activePaneId] ?? false,
      currentFileError: paneFileError[activePaneId] ?? '',
      currentFileProtocol: paneFileProtocol[activePaneId] ?? 'ftp',
      currentOpenFilePath: paneOpenFilePath[activePaneId] ?? null,
      currentOpenFileContent: paneOpenFileContent[activePaneId] ?? '',
      currentFileDirty: paneFileDirty[activePaneId] ?? false,
      currentFileSaving: paneFileSaving[activePaneId] ?? false,
      currentFileTransferRunning: paneFileTransferRunning[activePaneId] ?? false,
    }),
    [
      activePaneId,
      paneFileSessionId,
      paneFileList,
      paneFilePath,
      paneFileLoading,
      paneFileError,
      paneFileProtocol,
      paneOpenFilePath,
      paneOpenFileContent,
      paneFileDirty,
      paneFileSaving,
      paneFileTransferRunning,
    ]
  );

  const removePaneState = (paneId: string) => {
    const removePaneScopedState = <T,>(state: Record<string, T>) => {
      const next = { ...state };
      delete next[paneId];
      return next;
    };

    setPaneFileSessionId(prev => removePaneScopedState(prev));
    setPaneFileList(prev => removePaneScopedState(prev));
    setPaneFilePath(prev => removePaneScopedState(prev));
    setPaneFileLoading(prev => removePaneScopedState(prev));
    setPaneFileError(prev => removePaneScopedState(prev));
    setPaneFileProtocol(prev => removePaneScopedState(prev));
    setPaneOpenFilePath(prev => removePaneScopedState(prev));
    setPaneOpenFileContent(prev => removePaneScopedState(prev));
    setPaneFileDirty(prev => removePaneScopedState(prev));
    setPaneFileSaving(prev => removePaneScopedState(prev));
    setPaneFileTransferRunning(prev => removePaneScopedState(prev));
  };

  return {
    paneFileSessionId,
    setPaneFileSessionId,
    paneFileList,
    setPaneFileList,
    paneFilePath,
    setPaneFilePath,
    paneFileLoading,
    setPaneFileLoading,
    paneFileError,
    setPaneFileError,
    paneFileProtocol,
    setPaneFileProtocol,
    paneOpenFilePath,
    setPaneOpenFilePath,
    paneOpenFileContent,
    setPaneOpenFileContent,
    paneFileDirty,
    setPaneFileDirty,
    paneFileSaving,
    setPaneFileSaving,
    paneFileTransferRunning,
    setPaneFileTransferRunning,
    ...currentFileState,
    removePaneState,
  };
}
