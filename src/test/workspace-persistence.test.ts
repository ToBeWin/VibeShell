import React, { act } from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, Root } from 'react-dom/client';
import {
  restoreWorkspaceState,
  serializeWorkspaceState,
  useWorkspacePersistence,
} from '../hooks/useWorkspacePersistence';
import type { WorkspaceServer } from '../state/workspace';
import type { PaneConfig } from '../components/TerminalGrid';
import { invoke } from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('Workspace Persistence', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  const serverA: WorkspaceServer = {
    id: 'srv-a',
    name: 'server-a',
    host: '10.0.0.1',
    port: 22,
    user: 'root',
    connected: false,
  };
  const serverB: WorkspaceServer = {
    id: 'srv-b',
    name: 'server-b',
    host: '10.0.0.2',
    port: 22,
    user: 'admin',
    connected: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    root = null;
    container = null;
    vi.useRealTimers();
    delete (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  it('serializes panes by stable server identity', () => {
    const panes: PaneConfig[] = [
      { id: 'pane-a', serverId: 'srv-a', sessionKey: 'session-srv-a', label: 'root@10.0.0.1', host: '10.0.0.1', user: 'root', connected: false },
      { id: 'pane-a-2', serverId: 'srv-a', sessionKey: 'session-srv-a-2', label: 'root@10.0.0.1', host: '10.0.0.1', user: 'root', connected: false },
      { id: 'pane-b', serverId: 'srv-b', sessionKey: 'session-srv-b', label: 'admin@10.0.0.2', host: '10.0.0.2', user: 'admin', connected: false },
    ];

    const state = serializeWorkspaceState([serverA, serverB], panes, 'srv-a', 'pane-a-2');

    expect(state.sessions).toEqual([
      { server_id: 'srv-a', pane_ids: ['pane-a', 'pane-a-2'], active_pane_id: 'pane-a-2' },
      { server_id: 'srv-b', pane_ids: ['pane-b'], active_pane_id: undefined },
    ]);
  });

  it('restores sessions and panes from persisted state', () => {
    const restored = restoreWorkspaceState(
      {
        sessions: [
          { server_id: 'srv-a', pane_ids: ['pane-a', 'pane-a-2'], active_pane_id: 'pane-a-2' },
          { server_id: 'srv-b', pane_ids: ['pane-b'], active_pane_id: 'pane-b' },
        ],
        active_session_id: 'srv-a',
        last_saved: Date.now(),
      },
      [serverA, serverB]
    );

    expect(restored?.sessions.map(session => session.id)).toEqual(['srv-a', 'srv-b']);
    expect(restored?.panes.map(pane => pane.id)).toEqual(['pane-a', 'pane-a-2', 'pane-b']);
    expect(restored?.activeSessionId).toBe('srv-a');
    expect(restored?.activePaneId).toBe('pane-a-2');
  });

  it('waits for workspace load before auto-saving', async () => {
    let resolveLoad: ((value: {
      sessions: Array<{ server_id: string; pane_ids: string[]; active_pane_id?: string }>;
      active_session_id?: string;
      last_saved: number;
    } | null) => void) | null = null;
    const mockInvoke = vi.mocked(invoke);
    mockInvoke.mockImplementation((command: string) => {
      if (command === 'load_workspace_state') {
        return new Promise(resolve => {
          resolveLoad = resolve;
        });
      }
      return Promise.resolve(null);
    });

    function TestHarness() {
      useWorkspacePersistence({
        availableServers: [serverA],
        workspaceSessions: [serverA],
        workspacePanes: [
          {
            id: 'pane-a',
            serverId: 'srv-a',
            sessionKey: 'session-srv-a',
            label: 'root@10.0.0.1',
            host: '10.0.0.1',
            user: 'root',
            connected: false,
          },
        ],
        activeSessionId: 'srv-a',
        activePaneId: 'pane-a',
      });
      return null;
    }

    await act(async () => {
      root!.render(React.createElement(TestHarness));
    });

    await act(async () => {
      vi.advanceTimersByTime(1200);
      await Promise.resolve();
    });

    expect(mockInvoke).toHaveBeenCalledWith('load_workspace_state');
    expect(mockInvoke).not.toHaveBeenCalledWith(
      'save_workspace_state',
      expect.anything()
    );

    await act(async () => {
      resolveLoad?.(null);
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(1200);
      await Promise.resolve();
    });

    expect(mockInvoke).toHaveBeenCalledWith(
      'save_workspace_state',
      expect.objectContaining({
        workspaceState: expect.objectContaining({
          active_session_id: 'srv-a',
        }),
      })
    );
  });

  it('loads workspace state only once even if restore callback identity changes', async () => {
    const mockInvoke = vi.mocked(invoke);
    mockInvoke.mockResolvedValue(null);

    function TestHarness({ activePaneId }: { activePaneId: string }) {
      useWorkspacePersistence({
        availableServers: [serverA],
        workspaceSessions: [serverA],
        workspacePanes: [
          {
            id: activePaneId,
            serverId: 'srv-a',
            sessionKey: 'session-srv-a',
            label: 'root@10.0.0.1',
            host: '10.0.0.1',
            user: 'root',
            connected: false,
          },
        ],
        activeSessionId: 'srv-a',
        activePaneId,
        onRestore: () => {},
      });
      return null;
    }

    await act(async () => {
      root!.render(React.createElement(TestHarness, { activePaneId: 'pane-a' }));
      await Promise.resolve();
    });

    await act(async () => {
      root!.render(React.createElement(TestHarness, { activePaneId: 'pane-a-2' }));
      await Promise.resolve();
    });

    const loadCalls = mockInvoke.mock.calls.filter(([command]) => command === 'load_workspace_state');
    expect(loadCalls).toHaveLength(1);
  });
});
