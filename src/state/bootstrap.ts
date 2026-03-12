import { useEffect } from 'react';
import { PaneConfig } from '../components/TerminalGrid';
import { getServers, listOllamaModels, startOllamaService } from '../lib/tauri';
import { createPaneForServer, findSessionForPane, WorkspaceServer } from './workspace';
import { invoke } from '@tauri-apps/api/core';

type HotData = {
  bootstrapped?: boolean;
};

function getHotData(): HotData | undefined {
  return (import.meta as ImportMeta & { hot?: { data: HotData } }).hot?.data;
}

interface UseAppBootstrapOptions {
  ollamaUrl: string;
  activePaneId: string;
  activeSessionId: string;
  workspaceSessions: WorkspaceServer[];
  workspacePanes: PaneConfig[];
  setServers: React.Dispatch<React.SetStateAction<WorkspaceServer[]>>;
  setWorkspaceSessions: React.Dispatch<React.SetStateAction<WorkspaceServer[]>>;
  setWorkspacePanes: React.Dispatch<React.SetStateAction<PaneConfig[]>>;
  setActiveServer: React.Dispatch<React.SetStateAction<WorkspaceServer>>;
  setActiveSessionId: React.Dispatch<React.SetStateAction<string>>;
  setActivePaneId: React.Dispatch<React.SetStateAction<string>>;
  setOllamaModels: React.Dispatch<React.SetStateAction<string[]>>;
  setOllamaModel: React.Dispatch<React.SetStateAction<string>>;
  onServersHydrated?: () => void;
}

export function useAppBootstrap({
  ollamaUrl,
  activePaneId,
  activeSessionId,
  workspaceSessions,
  workspacePanes,
  setServers,
  setWorkspaceSessions,
  setWorkspacePanes,
  setActiveServer,
  setActiveSessionId,
  setActivePaneId,
  setOllamaModels,
  setOllamaModel,
  onServersHydrated,
}: UseAppBootstrapOptions) {
  useEffect(() => {
    const hotData = getHotData();
    if (hotData?.bootstrapped) {
      onServersHydrated?.();
      return;
    }
    if (hotData) {
      hotData.bootstrapped = true;
    }

    let cancelled = false;

    getServers().then(async savedServers => {
      if (cancelled) {
        return;
      }
      if (savedServers.length === 0) {
        onServersHydrated?.();
        return;
      }
      const nextServers = savedServers.map(server => ({ ...server, connected: false }));
      setServers(nextServers);
      setWorkspaceSessions(nextServers);
      setActiveServer(nextServers[0]);
      setActiveSessionId(nextServers[0].id);
      setWorkspacePanes([createPaneForServer(nextServers[0])]);
      setActivePaneId(`pane-${nextServers[0].id}`);
      
      // Auto-add servers to Favorites group if they're not in any group
      try {
        const groups = await invoke<any[]>('load_server_groups');
        if (cancelled) {
          return;
        }
        const allGroupedServerIds = new Set(groups.flatMap(g => g.server_ids));
        
        for (const server of nextServers) {
          if (cancelled) {
            return;
          }
          if (!allGroupedServerIds.has(server.id)) {
            await invoke('add_server_to_group', { groupId: 'favorites', serverId: server.id });
          }
        }
      } catch (error) {
        console.warn('Failed to auto-group servers:', error);
      }
      onServersHydrated?.();
    }).catch(() => {
      onServersHydrated?.();
    });

    const bootstrapOllama = async () => {
      try {
        const models = await listOllamaModels(ollamaUrl);
        if (cancelled) return;
        if (models.length > 0) {
          setOllamaModels(models);
          setOllamaModel(models[0]);
          return;
        }
      } catch {}

      try {
        const models = await startOllamaService(ollamaUrl);
        if (cancelled) return;
        if (models.length > 0) {
          setOllamaModels(models);
          setOllamaModel(models[0]);
        }
      } catch {}
    };

    bootstrapOllama();

    return () => {
      cancelled = true;
    };
  }, [
    ollamaUrl,
    setActivePaneId,
    setActiveServer,
    setActiveSessionId,
    setOllamaModel,
    setOllamaModels,
    setServers,
    setWorkspacePanes,
    setWorkspaceSessions,
    onServersHydrated,
  ]);

  useEffect(() => {
    const current = workspaceSessions.find(session => session.id === activeSessionId);
    if (current) {
      setActiveServer(current);
    }
  }, [activeSessionId, setActiveServer, workspaceSessions]);

  useEffect(() => {
    const activePane = workspacePanes.find(pane => pane.id === activePaneId);
    if (!activePane) return;
    const paneSession = findSessionForPane(workspaceSessions, activePane);
    if (paneSession && paneSession.id !== activeSessionId) {
      setActiveSessionId(paneSession.id);
    }
  }, [activePaneId, activeSessionId, setActiveSessionId, workspacePanes, workspaceSessions]);
}
