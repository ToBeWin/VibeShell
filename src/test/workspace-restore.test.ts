import { describe, expect, it } from 'vitest';
import { shouldApplyRestoredWorkspace } from '../state/workspace-restore';
import type { WorkspaceServer } from '../state/workspace';
import type { PaneConfig } from '../components/TerminalGrid';

describe('Workspace Restore Guard', () => {
  const server: WorkspaceServer = {
    id: 'srv-1',
    name: 'prod',
    host: '10.0.0.10',
    port: 22,
    user: 'root',
    connected: false,
  };

  const defaultPane: PaneConfig = {
    id: 'pane-srv-1',
    serverId: 'srv-1',
    sessionKey: 'session-srv-1',
    host: '10.0.0.10',
    user: 'root',
    label: 'root@10.0.0.10',
    connected: false,
  };

  it('allows restore against untouched hydrated workspace state', () => {
    expect(shouldApplyRestoredWorkspace({
      servers: [server],
      workspacePanes: [defaultPane],
      activeSessionId: 'srv-1',
      activePaneId: 'pane-srv-1',
    })).toBe(true);
  });

  it('skips restore once a pane is already connecting or connected', () => {
    expect(shouldApplyRestoredWorkspace({
      servers: [server],
      workspacePanes: [{ ...defaultPane, connecting: true, sessionId: 'session-srv-1' }],
      activeSessionId: 'srv-1',
      activePaneId: 'pane-srv-1',
    })).toBe(false);
  });

  it('skips restore once the user has already customized the workspace', () => {
    expect(shouldApplyRestoredWorkspace({
      servers: [server],
      workspacePanes: [defaultPane, { ...defaultPane, id: 'pane-split-1', sessionKey: 'session-srv-1-2' }],
      activeSessionId: 'srv-1',
      activePaneId: 'pane-split-1',
    })).toBe(false);
  });
});
