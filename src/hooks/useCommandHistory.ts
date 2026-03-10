import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface HistoryEntry {
  command: string;
  timestamp: number;
}

export interface HistoryState {
  entries: HistoryEntry[];
  currentIndex: number;
  searchMode: boolean;
  searchQuery: string;
  searchResults: HistoryEntry[];
  searchIndex: number;
  savedInput: string;
}

export function useCommandHistory(sessionId: string | null) {
  const [state, setState] = useState<HistoryState>({
    entries: [],
    currentIndex: -1,
    searchMode: false,
    searchQuery: '',
    searchResults: [],
    searchIndex: -1,
    savedInput: '',
  });

  const loadHistory = useCallback(async () => {
    if (!sessionId) return;
    
    try {
      const entries = await invoke<HistoryEntry[]>('load_command_history', {
        serverId: sessionId,
      });
      setState(prev => ({ ...prev, entries }));
    } catch (error) {
      console.error('Failed to load command history:', error);
    }
  }, [sessionId]);

  const appendCommand = useCallback(async (command: string) => {
    if (!sessionId || !command.trim()) return;
    
    try {
      await invoke('append_command_history', {
        serverId: sessionId,
        command: command.trim(),
      });
      
      // Add to local state
      setState(prev => ({
        ...prev,
        entries: [...prev.entries, { command: command.trim(), timestamp: Date.now() / 1000 }],
        currentIndex: -1,
        savedInput: '',
      }));
    } catch (error) {
      console.error('Failed to append command to history:', error);
    }
  }, [sessionId]);

  const navigateUp = useCallback((currentInput: string) => {
    setState(prev => {
      if (prev.entries.length === 0) return prev;
      
      // Save current input if at the bottom
      const savedInput = prev.currentIndex === -1 ? currentInput : prev.savedInput;
      
      // Move up in history
      const newIndex = prev.currentIndex === -1 
        ? prev.entries.length - 1 
        : Math.max(0, prev.currentIndex - 1);
      
      return {
        ...prev,
        currentIndex: newIndex,
        savedInput,
      };
    });
    
    return state.entries[state.currentIndex === -1 ? state.entries.length - 1 : Math.max(0, state.currentIndex - 1)]?.command || '';
  }, [state.entries, state.currentIndex]);

  const navigateDown = useCallback((_currentInput: string) => {
    setState(prev => {
      if (prev.currentIndex === -1) return prev;
      
      // Move down in history
      const newIndex = prev.currentIndex + 1;
      
      if (newIndex >= prev.entries.length) {
        // Back to current input
        return {
          ...prev,
          currentIndex: -1,
        };
      }
      
      return {
        ...prev,
        currentIndex: newIndex,
      };
    });
    
    if (state.currentIndex + 1 >= state.entries.length) {
      return state.savedInput;
    }
    
    return state.entries[state.currentIndex + 1]?.command || '';
  }, [state.entries, state.currentIndex, state.savedInput]);

  const startSearch = useCallback((query: string) => {
    setState(prev => ({
      ...prev,
      searchMode: true,
      searchQuery: query,
      searchIndex: -1,
    }));
  }, []);

  const searchNext = useCallback(async () => {
    if (!sessionId || !state.searchQuery) return null;
    
    try {
      const results = await invoke<HistoryEntry[]>('search_command_history', {
        serverId: sessionId,
        query: state.searchQuery,
      });
      
      setState(prev => ({
        ...prev,
        searchResults: results,
        searchIndex: results.length > 0 ? 0 : -1,
      }));
      
      return results.length > 0 ? results[0].command : null;
    } catch (error) {
      console.error('Failed to search command history:', error);
      return null;
    }
  }, [sessionId, state.searchQuery]);

  const exitSearch = useCallback(() => {
    setState(prev => ({
      ...prev,
      searchMode: false,
      searchQuery: '',
      searchResults: [],
      searchIndex: -1,
    }));
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  return {
    ...state,
    navigateUp,
    navigateDown,
    startSearch,
    searchNext,
    exitSearch,
    appendCommand,
    loadHistory,
  };
}
