import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface SavedConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  user: string;
  password?: string;
  private_key?: string;
  created_at: number;
  last_used: number;
}

export interface ConnectionManagerState {
  connections: SavedConnection[];
  loading: boolean;
  error: string | null;
}

export function useConnectionManager() {
  const [state, setState] = useState<ConnectionManagerState>({
    connections: [],
    loading: false,
    error: null,
  });

  const loadConnections = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const connections = await invoke<SavedConnection[]>('load_connection_configs');
      setState({ connections, loading: false, error: null });
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }, []);

  const saveConnection = useCallback(async (connection: SavedConnection) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      await invoke('save_connection_config', { config: connection });
      await loadConnections();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Provide user-friendly error messages
      let friendlyMessage = errorMessage;
      if (errorMessage.includes('keychain')) {
        friendlyMessage = 'Failed to save credentials securely. Please check system keychain permissions.';
      } else if (errorMessage.includes('storage') || errorMessage.includes('write')) {
        friendlyMessage = 'Failed to save connection configuration. Please check disk space and permissions.';
      }
      
      setState(prev => ({
        ...prev,
        loading: false,
        error: friendlyMessage,
      }));
      throw new Error(friendlyMessage);
    }
  }, [loadConnections]);

  const deleteConnection = useCallback(async (id: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      await invoke('delete_connection_config', { id });
      await loadConnections();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Provide user-friendly error messages
      let friendlyMessage = errorMessage;
      if (errorMessage.includes('not found')) {
        friendlyMessage = 'Connection not found. It may have been already deleted.';
      } else if (errorMessage.includes('keychain')) {
        friendlyMessage = 'Failed to delete credentials from keychain. Please check system permissions.';
      }
      
      setState(prev => ({
        ...prev,
        loading: false,
        error: friendlyMessage,
      }));
      throw new Error(friendlyMessage);
    }
  }, [loadConnections]);

  const connectToSaved = useCallback(async (connection: SavedConnection) => {
    try {
      // Update last_used timestamp
      await invoke('update_connection_last_used', { id: connection.id });
      
      // Return connection details for the caller to initiate connection
      return connection;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : String(error),
      }));
      throw error;
    }
  }, []);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  return {
    ...state,
    loadConnections,
    saveConnection,
    deleteConnection,
    connectToSaved,
  };
}
