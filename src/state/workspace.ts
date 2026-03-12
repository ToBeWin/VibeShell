import { useMemo, useState } from 'react';
import { ServerConfig } from '../lib/tauri';
import { ProviderProfile } from '../lib/domain';
import { PaneConfig } from '../components/TerminalGrid';

export interface WorkspaceServer extends ServerConfig {
  connected: boolean;
}

export interface WorkspaceStateValue {
  servers: WorkspaceServer[];
  setServers: React.Dispatch<React.SetStateAction<WorkspaceServer[]>>;
  sessions: WorkspaceServer[];
  setSessions: React.Dispatch<React.SetStateAction<WorkspaceServer[]>>;
  panes: PaneConfig[];
  setPanes: React.Dispatch<React.SetStateAction<PaneConfig[]>>;
  activeServer: WorkspaceServer;
  setActiveServer: React.Dispatch<React.SetStateAction<WorkspaceServer>>;
  activeSessionId: string;
  setActiveSessionId: React.Dispatch<React.SetStateAction<string>>;
  activePaneId: string;
  setActivePaneId: React.Dispatch<React.SetStateAction<string>>;
  providers: ProviderProfile[];
  setProviders: React.Dispatch<React.SetStateAction<ProviderProfile[]>>;
  currentPane: PaneConfig;
}

export function createPaneForServer(server: WorkspaceServer): PaneConfig {
  return {
    id: `pane-${server.id}`,
    serverId: server.id,
    sessionKey: `session-${server.id}`,
    sessionId: server.connected ? `session-${server.id}` : undefined,
    label: `${server.user}@${server.host}`,
    host: server.host,
    user: server.user,
    connected: server.connected,
    connecting: false,
  };
}

export function createWorkspaceSeed(servers: WorkspaceServer[]) {
  const primary = servers[0];
  const panes = primary ? [createPaneForServer(primary)] : [];
  return {
    servers,
    sessions: servers,
    panes,
    activeServer: primary,
    activeSessionId: primary?.id ?? '',
    activePaneId: panes[0]?.id ?? '',
  };
}

export function findPaneForServer(panes: PaneConfig[], server: WorkspaceServer): PaneConfig | undefined {
  const byServerId = panes.find(pane => pane.serverId === server.id);
  if (byServerId) {
    return byServerId;
  }

  return panes.find(
    pane =>
      pane.host === server.host &&
      pane.user === server.user &&
      (pane.sessionKey === `session-${server.id}` || pane.id === `pane-${server.id}`)
  ) ?? panes.find(pane => pane.host === server.host && pane.user === server.user);
}

export function isPaneOwnedByServer(pane: PaneConfig, serverId: string): boolean {
  return (
    pane.serverId === serverId ||
    pane.id === `pane-${serverId}` ||
    (pane.sessionKey?.startsWith(`session-${serverId}`) ?? false)
  );
}

export function findSessionForPane(sessions: WorkspaceServer[], pane?: PaneConfig): WorkspaceServer | undefined {
  if (!pane) return undefined;
  if (pane.serverId) {
    const byId = sessions.find(session => session.id === pane.serverId);
    if (byId) {
      return byId;
    }
  }
  return sessions.find(session => session.host === pane.host && session.user === pane.user);
}

export function selectServerTargets(
  panes: PaneConfig[],
  sessions: WorkspaceServer[],
  server: WorkspaceServer
) {
  return {
    pane: findPaneForServer(panes, server),
    session: sessions.find(session => session.id === server.id),
  };
}

export function selectPaneTargets(
  panes: PaneConfig[],
  sessions: WorkspaceServer[],
  paneId: string
) {
  const pane = panes.find(entry => entry.id === paneId);
  return {
    pane,
    session: findSessionForPane(sessions, pane),
  };
}

export function selectSessionTargets(
  panes: PaneConfig[],
  sessions: WorkspaceServer[],
  sessionId: string
) {
  const session = sessions.find(entry => entry.id === sessionId);
  const pane = panes.find(entry => entry.serverId === sessionId)
    ?? panes.find(
      entry => entry.id === `pane-${sessionId}` || entry.sessionKey === `session-${sessionId}`
    )
    ?? (session ? findPaneForServer(panes, session) : undefined);

  return {
    pane,
    session,
  };
}

export function createDerivedPane(sourcePane: PaneConfig, activeServerId: string): PaneConfig {
  return {
    ...sourcePane,
    id: `pane-${Date.now()}`,
    serverId: sourcePane.serverId ?? activeServerId,
    sessionKey: `${sourcePane.sessionKey ?? sourcePane.sessionId ?? `session-${activeServerId}`}-${Date.now()}`,
    sessionId: undefined,
    label: `${sourcePane.user}@${sourcePane.host}`,
    connected: false,
    connecting: false,
  };
}

export function appendServerToWorkspace(
  panes: PaneConfig[],
  server: WorkspaceServer
) {
  const pane = createPaneForServer(server);
  return {
    pane,
    panes: [...panes, pane],
    activePaneId: pane.id,
    activeSessionId: server.id,
    activeServer: server,
  };
}

export function ensurePaneForServer(
  panes: PaneConfig[],
  server: WorkspaceServer
) {
  const existing = findPaneForServer(panes, server);
  if (existing) {
    return {
      pane: existing,
      panes,
    };
  }

  const pane = createPaneForServer(server);
  return {
    pane,
    panes: [...panes, pane],
  };
}

export function collectPaneIdsForServer(
  panes: PaneConfig[],
  serverId: string
): string[] {
  return panes
    .filter(pane => isPaneOwnedByServer(pane, serverId))
    .map(pane => pane.id);
}

export function collectPaneIdsForSession(
  panes: PaneConfig[],
  sessionId: string
): string[] {
  return panes
    .filter(pane => isPaneOwnedByServer(pane, sessionId))
    .map(pane => pane.id);
}

export function removePaneFromWorkspace(
  panes: PaneConfig[],
  sessions: WorkspaceServer[],
  paneId: string,
  activePaneId: string
) {
  if (panes.length <= 1) {
    return {
      panes,
      nextActivePane: undefined,
      nextActiveSession: undefined,
    };
  }

  const nextPanes = panes.filter(pane => pane.id !== paneId);
  if (nextPanes.length === panes.length) {
    return {
      panes,
      nextActivePane: undefined,
      nextActiveSession: undefined,
    };
  }

  if (activePaneId !== paneId) {
    return {
      panes: nextPanes,
      nextActivePane: undefined,
      nextActiveSession: undefined,
    };
  }

  const nextActivePane = nextPanes[0];
  return {
    panes: nextPanes,
    nextActivePane,
    nextActiveSession: findSessionForPane(sessions, nextActivePane),
  };
}

export function removePaneScopedState<T>(state: Record<string, T>, paneId: string): Record<string, T> {
  const next = { ...state };
  delete next[paneId];
  return next;
}

export function useWorkspaceState(initialServers: WorkspaceServer[]): WorkspaceStateValue {
  const seed = useMemo(() => createWorkspaceSeed(initialServers), [initialServers]);
  const [servers, setServers] = useState<WorkspaceServer[]>(seed.servers);
  const [sessions, setSessions] = useState<WorkspaceServer[]>(seed.sessions);
  const [panes, setPanes] = useState<PaneConfig[]>(seed.panes);
  const [activeServer, setActiveServer] = useState<WorkspaceServer>(seed.activeServer);
  const [activeSessionId, setActiveSessionId] = useState(seed.activeSessionId);
  const [activePaneId, setActivePaneId] = useState(seed.activePaneId);
  const [providers, setProviders] = useState<ProviderProfile[]>([]);

  const currentPane = useMemo(
    () =>
      panes.find(pane => pane.id === activePaneId) ??
      panes[0] ??
      createPaneForServer(activeServer),
    [activePaneId, panes, activeServer]
  );

  return {
    servers,
    setServers,
    sessions,
    setSessions,
    panes,
    setPanes,
    activeServer,
    setActiveServer,
    activeSessionId,
    setActiveSessionId,
    activePaneId,
    setActivePaneId,
    providers,
    setProviders,
    currentPane,
  };
}
