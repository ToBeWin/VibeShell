import type { PaneConfig } from '../components/TerminalGrid';
import type { WorkspaceServer } from './workspace';

interface RestoreGuardOptions {
  servers: WorkspaceServer[];
  workspacePanes: PaneConfig[];
  activeSessionId: string;
  activePaneId: string;
}

export function shouldApplyRestoredWorkspace({
  servers,
  workspacePanes,
  activeSessionId,
  activePaneId,
}: RestoreGuardOptions) {
  if (servers.length === 0) {
    return false;
  }

  const defaultServer = servers[0];
  const defaultPaneId = `pane-${defaultServer.id}`;
  const hasLiveConnectionState = workspacePanes.some(
    pane => pane.connected || pane.connecting || Boolean(pane.sessionId)
  );
  const hasCustomizedWorkspace =
    workspacePanes.length > 1 ||
    activeSessionId !== defaultServer.id ||
    activePaneId !== defaultPaneId;

  return !hasLiveConnectionState && !hasCustomizedWorkspace;
}
