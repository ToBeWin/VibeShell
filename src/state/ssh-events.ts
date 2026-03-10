import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { PaneConfig } from '../components/TerminalGrid';
import { WorkspaceServer } from './workspace';

interface SshStatusPayload {
  session_id: string;
  level: string;
  message: string;
}

interface UseSshSessionEventsOptions {
  workspacePanes: PaneConfig[];
  setWorkspacePanes: React.Dispatch<React.SetStateAction<PaneConfig[]>>;
  setServers: React.Dispatch<React.SetStateAction<WorkspaceServer[]>>;
  setWorkspaceSessions: React.Dispatch<React.SetStateAction<WorkspaceServer[]>>;
  setActiveServer: React.Dispatch<React.SetStateAction<WorkspaceServer>>;
}

function isConnectedStatus(payload: SshStatusPayload) {
  return payload.level === 'info' && payload.message === 'SSH session connected';
}

function isDisconnectedStatus(payload: SshStatusPayload) {
  return payload.message === 'SSH session disconnected'
    || payload.message === 'SSH input loop closed'
    || payload.message.startsWith('SSH channel closed:');
}

export function useSshSessionEvents({
  workspacePanes,
  setWorkspacePanes,
  setServers,
  setWorkspaceSessions,
  setActiveServer,
}: UseSshSessionEventsOptions) {
  const sessionIds = Array.from(new Set(
    workspacePanes
      .map(pane => pane.sessionId ?? pane.sessionKey)
      .filter((sessionId): sessionId is string => Boolean(sessionId))
  ));
  const sessionIdsKey = sessionIds.slice().sort().join('|');

  useEffect(() => {
    if (sessionIds.length === 0) {
      return;
    }

    let disposed = false;
    const unlistenFns: Array<() => void> = [];

    Promise.all(sessionIds.map(sessionId =>
      listen<SshStatusPayload>(`ssh-status-${sessionId}`, event => {
        if (disposed) return;
        const payload = event.payload;
        if (!isConnectedStatus(payload) && !isDisconnectedStatus(payload)) {
          return;
        }

        setWorkspacePanes(prevPanes => {
          const nextPanes = prevPanes.map(pane => {
            const paneSessionRef = pane.sessionId ?? pane.sessionKey;
            if (paneSessionRef !== payload.session_id) {
              return pane;
            }
            if (isConnectedStatus(payload)) {
              return { ...pane, connected: true, connecting: false, sessionId: payload.session_id };
            }
            return { ...pane, connected: false, connecting: false, sessionId: undefined };
          });

          const connectedPairs = new Set(
            nextPanes
              .filter(pane => pane.connected)
              .map(pane => `${pane.host}::${pane.user}`)
          );

          setServers(prevServers => prevServers.map(server => ({
            ...server,
            connected: connectedPairs.has(`${server.host}::${server.user}`),
          })));

          setWorkspaceSessions(prevSessions => prevSessions.map(session => ({
            ...session,
            connected: connectedPairs.has(`${session.host}::${session.user}`),
          })));

          setActiveServer(prevActive => ({
            ...prevActive,
            connected: connectedPairs.has(`${prevActive.host}::${prevActive.user}`),
          }));

          return nextPanes;
        });
      })
    )).then(fns => {
      if (disposed) {
        fns.forEach(fn => fn());
        return;
      }
      unlistenFns.push(...fns);
    });

    return () => {
      disposed = true;
      unlistenFns.forEach(fn => fn());
    };
  }, [
    sessionIdsKey,
    setActiveServer,
    setServers,
    setWorkspacePanes,
    setWorkspaceSessions,
  ]);
}
