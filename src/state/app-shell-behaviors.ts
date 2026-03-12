import { useCallback, useMemo } from 'react';
import { SessionContext } from '../lib/domain';
import { PaneConfig } from '../components/TerminalGrid';
import { findSessionForPane, WorkspaceServer } from './workspace';

interface UseAppShellBehaviorsOptions {
  zenMode: boolean;
  setZenMode: React.Dispatch<React.SetStateAction<boolean>>;
  activePaneId: string;
  activeServer: WorkspaceServer;
  currentPane: PaneConfig;
  workspaceSessions: WorkspaceServer[];
  currentCommandHistory: string[];
  currentRagContext: string[];
  currentFileSessionId: string | null;
  currentFilePath: string;
  currentOpenFilePath: string | null;
  recordTerminalLine: (paneId: string, line: string) => void;
}

export function resolveCurrentPanePort(
  currentPane: PaneConfig,
  workspaceSessions: WorkspaceServer[],
  activeServer: WorkspaceServer
) {
  return findSessionForPane(workspaceSessions, currentPane)?.port ?? activeServer.port;
}

export function useAppShellBehaviors({
  zenMode,
  setZenMode,
  activePaneId,
  activeServer,
  currentPane,
  workspaceSessions,
  currentCommandHistory,
  currentRagContext,
  currentFileSessionId,
  currentFilePath,
  currentOpenFilePath,
  recordTerminalLine,
}: UseAppShellBehaviorsOptions) {
  const handleTerminalLine = useCallback((line: string) => {
    recordTerminalLine(activePaneId, line);
  }, [activePaneId, recordTerminalLine]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && zenMode) {
      setZenMode(false);
    }
    if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
      event.preventDefault();
      setZenMode(value => !value);
    }
  }, [setZenMode, zenMode]);

  const currentPanePort = useMemo(
    () => resolveCurrentPanePort(currentPane, workspaceSessions, activeServer),
    [activeServer, currentPane, workspaceSessions]
  );

  const sessionContext: SessionContext = useMemo(() => ({
    sessionId: currentPane.sessionId,
    paneId: currentPane.id,
    host: currentPane.host,
    user: currentPane.user,
    cwd: '~',
    filePath: currentOpenFilePath ?? currentFilePath,
    contextKind: currentPane.sessionId
      ? 'terminal'
      : currentFileSessionId
        ? 'files'
        : 'workspace',
    recentCommands: currentCommandHistory,
    recentOutput: currentRagContext,
  }), [
    currentCommandHistory,
    currentFilePath,
    currentFileSessionId,
    currentOpenFilePath,
    currentPane.host,
    currentPane.id,
    currentPane.sessionId,
    currentPane.user,
    currentRagContext,
  ]);

  return {
    handleTerminalLine,
    handleKeyDown,
    currentPanePort,
    sessionContext,
  };
}
