import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface ServerGroup {
  id: string;
  name: string;
  icon?: string;
  collapsed: boolean;
  order: number;
  server_ids: string[];
  created_at: number;
}

export function useServerGroups() {
  const [groups, setGroups] = useState<ServerGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadGroups = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loadedGroups = await invoke<ServerGroup[]>('load_server_groups');
      setGroups(loadedGroups);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const saveGroup = useCallback(async (group: ServerGroup) => {
    try {
      await invoke('save_server_group', { group });
      await loadGroups();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }, [loadGroups]);

  const deleteGroup = useCallback(async (id: string) => {
    try {
      await invoke('delete_server_group', { id });
      await loadGroups();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }, [loadGroups]);

  const addServerToGroup = useCallback(async (groupId: string, serverId: string) => {
    try {
      await invoke('add_server_to_group', { groupId, serverId });
      await loadGroups();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }, [loadGroups]);

  const removeServerFromGroup = useCallback(async (groupId: string, serverId: string) => {
    try {
      await invoke('remove_server_from_group', { groupId, serverId });
      await loadGroups();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }, [loadGroups]);

  const toggleGroupCollapsed = useCallback(async (id: string) => {
    try {
      await invoke('toggle_group_collapsed', { id });
      // Optimistic update
      setGroups(prev => prev.map(g => 
        g.id === id ? { ...g, collapsed: !g.collapsed } : g
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      // Reload on error
      await loadGroups();
    }
  }, [loadGroups]);

  const reorderGroups = useCallback(async (groupIds: string[]) => {
    try {
      await invoke('reorder_server_groups', { groupIds });
      await loadGroups();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }, [loadGroups]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  return {
    groups,
    loading,
    error,
    loadGroups,
    saveGroup,
    deleteGroup,
    addServerToGroup,
    removeServerFromGroup,
    toggleGroupCollapsed,
    reorderGroups,
  };
}
