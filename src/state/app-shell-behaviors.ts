import { useCallback, useMemo } from 'react';
import { SessionContext } from '../lib/domain';
import { PaneConfig } from '../components/TerminalGrid';
import { WorkspaceServer } from './workspace';

interface UseAppShellBehaviorsOptions {
  zenMode: boolean;
  setZenMode: React.Dispatch<React.SetStateAction<boolean>>;
  activePaneId: string;
  activeServer: WorkspaceServer;
  currentPane: PaneConfig;
  workspaceSessions: WorkspaceServer[];
  currentCommandHistory: string[];
  currentRagContext: string[];
  recordTerminalLine: (paneId: string, line: string) => void;
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

  const owningSessionForCurrentPane = useMemo(
    () => workspaceSessions.find(session => session.host === currentPane.host && session.user === currentPane.user),
    [currentPane.host, currentPane.user, workspaceSessions]
  );

  const currentPanePort = owningSessionForCurrentPane?.port ?? activeServer.port;

  const sessionContext: SessionContext = useMemo(() => ({
    sessionId: currentPane.sessionId,
    paneId: currentPane.id,
    host: currentPane.host,
    user: currentPane.user,
    cwd: '~',
    recentCommands: currentCommandHistory,
    recentOutput: currentRagContext,
  }), [
    currentCommandHistory,
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
