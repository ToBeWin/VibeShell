import { describe, expect, it } from 'vitest';
import { resolveCurrentPanePort } from '../state/app-shell-behaviors';
import type { WorkspaceServer } from '../state/workspace';
import type { PaneConfig } from '../components/TerminalGrid';

describe('App Shell Behaviors', () => {
  const fallbackServer: WorkspaceServer = {
    id: 'srv-fallback',
    name: 'fallback',
    host: '10.0.0.1',
    port: 22,
    user: 'root',
    connected: false,
  };

  it('prefers stable serverId when resolving current pane port', () => {
    const restoredPane: PaneConfig = {
      id: 'pane-restored',
      serverId: 'srv-alt',
      host: 'same-host',
      user: 'same-user',
      label: 'same-user@same-host',
      connected: false,
    };
    const sessions: WorkspaceServer[] = [
      {
        id: 'srv-fallback',
        name: 'fallback',
        host: 'same-host',
        port: 22,
        user: 'same-user',
        connected: false,
      },
      {
        id: 'srv-alt',
        name: 'alt',
        host: 'different-host',
        port: 2222,
        user: 'different-user',
        connected: false,
      },
    ];

    expect(resolveCurrentPanePort(restoredPane, sessions, fallbackServer)).toBe(2222);
  });

  it('falls back to active server port when no owning session exists', () => {
    const pane: PaneConfig = {
      id: 'pane-missing',
      serverId: 'srv-missing',
      host: 'missing-host',
      user: 'missing-user',
      label: 'missing',
      connected: false,
    };

    expect(resolveCurrentPanePort(pane, [], fallbackServer)).toBe(22);
  });
});
