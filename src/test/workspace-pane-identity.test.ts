import { describe, expect, it } from 'vitest';
import {
  collectPaneIdsForServer,
  createDerivedPane,
  createPaneForServer,
  findSessionForPane,
  findPaneForServer,
  selectSessionTargets,
  type WorkspaceServer,
} from '../state/workspace';

describe('Workspace Pane Identity', () => {
  const server: WorkspaceServer = {
    id: 'srv-prod-1',
    name: 'prod',
    host: '10.0.0.10',
    port: 22,
    user: 'root',
    connected: false,
  };

  it('assigns a stable serverId to primary panes', () => {
    const pane = createPaneForServer(server);
    expect(pane.serverId).toBe('srv-prod-1');
  });

  it('preserves serverId for derived panes', () => {
    const sourcePane = createPaneForServer(server);
    const derived = createDerivedPane(sourcePane, server.id);
    expect(derived.serverId).toBe('srv-prod-1');
  });

  it('resolves sessions by serverId before falling back to host/user matching', () => {
    const pane = {
      id: 'pane-random',
      serverId: 'srv-prod-1',
      host: 'other-host',
      user: 'other-user',
      label: 'other',
      connected: false,
    };

    expect(findSessionForPane([server], pane)?.id).toBe('srv-prod-1');
  });

  it('finds restored panes by stable serverId before host/user fallback', () => {
    const restoredPane = {
      id: 'pane-restored-random',
      serverId: 'srv-prod-1',
      sessionKey: 'session-srv-prod-1',
      host: 'mismatched-host',
      user: 'mismatched-user',
      label: 'restored',
      connected: false,
    };

    expect(findPaneForServer([restoredPane], server)?.id).toBe('pane-restored-random');
  });

  it('collects pane ids by serverId even when pane ids are custom', () => {
    const restoredPrimary = {
      id: 'pane-restored-primary',
      serverId: 'srv-prod-1',
      host: '10.0.0.10',
      user: 'root',
      label: 'root@10.0.0.10',
      connected: false,
    };
    const restoredDerived = {
      id: 'pane-restored-derived',
      serverId: 'srv-prod-1',
      host: '10.0.0.10',
      user: 'root',
      label: 'root@10.0.0.10',
      connected: false,
    };

    expect(collectPaneIdsForServer([restoredPrimary, restoredDerived], 'srv-prod-1')).toEqual([
      'pane-restored-primary',
      'pane-restored-derived',
    ]);
  });

  it('selects session targets by serverId for restored panes', () => {
    const restoredPane = {
      id: 'pane-restored-session',
      serverId: 'srv-prod-1',
      host: '10.0.0.10',
      user: 'root',
      label: 'root@10.0.0.10',
      connected: false,
    };

    expect(selectSessionTargets([restoredPane], [server], 'srv-prod-1').pane?.id).toBe('pane-restored-session');
  });
});
