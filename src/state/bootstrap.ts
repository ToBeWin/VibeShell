import { useEffect } from 'react';
import { PaneConfig } from '../components/TerminalGrid';
import { getServers, listOllamaModels } from '../lib/tauri';
import { createPaneForServer, findSessionForPane, WorkspaceServer } from './workspace';
import { invoke } from '@tauri-apps/api/core';

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
}: UseAppBootstrapOptions) {
  useEffect(() => {
    getServers().then(async savedServers => {
      if (savedServers.length === 0) return;
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
        const allGroupedServerIds = new Set(groups.flatMap(g => g.server_ids));
        
        for (const server of nextServers) {
          if (!allGroupedServerIds.has(server.id)) {
            await invoke('add_server_to_group', { groupId: 'favorites', serverId: server.id });
          }
        }
      } catch (error) {
        console.warn('Failed to auto-group servers:', error);
      }
    });

    listOllamaModels(ollamaUrl)
      .then(models => {
        if (models.length > 0) {
          setOllamaModels(models);
          setOllamaModel(models[0]);
        }
      })
      .catch(() => {});
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
