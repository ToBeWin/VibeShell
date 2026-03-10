import { useEffect, useMemo, useState } from 'react';
import { AgentAction, AgentResponse } from '../lib/domain';
import { ChatMessage } from '../lib/tauri';

export interface AiConfig {
  provider: 'ollama' | 'openai' | 'anthropic';
  model: string;
  ollamaBaseUrl: string;
  apiKey?: string;
  maxContextTokens: number;
}

export interface PaneAiStateValue {
  paneChatHistory: Record<string, ChatMessage[]>;
  setPaneChatHistory: React.Dispatch<React.SetStateAction<Record<string, ChatMessage[]>>>;
  paneThinkingState: Record<string, boolean>;
  setPaneThinkingState: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  paneAgentPrompt: Record<string, string>;
  setPaneAgentPrompt: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  paneAgentAction: Record<string, AgentAction>;
  setPaneAgentAction: React.Dispatch<React.SetStateAction<Record<string, AgentAction>>>;
  paneAgentRunning: Record<string, boolean>;
  setPaneAgentRunning: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  paneAgentResponse: Record<string, AgentResponse | null>;
  setPaneAgentResponse: React.Dispatch<React.SetStateAction<Record<string, AgentResponse | null>>>;
  paneAgentError: Record<string, string>;
  setPaneAgentError: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  paneRagContext: Record<string, string[]>;
  setPaneRagContext: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  paneCommandHistory: Record<string, string[]>;
  setPaneCommandHistory: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  currentChatHistory: ChatMessage[];
  isThinking: boolean;
  currentAgentPrompt: string;
  currentAgentAction: AgentAction;
  currentAgentRunning: boolean;
  currentAgentResponse: AgentResponse | null;
  currentAgentError: string;
  currentRagContext: string[];
  currentCommandHistory: string[];
  aiConfig: AiConfig;
  setAiConfig: React.Dispatch<React.SetStateAction<AiConfig>>;
  recordTerminalLine: (paneId: string, line: string) => void;
  removePaneState: (paneId: string) => void;
}

export function usePaneAiState(activePaneId: string, welcomeMessage: string): PaneAiStateValue {
  const [paneChatHistory, setPaneChatHistory] = useState<Record<string, ChatMessage[]>>(() => {
    const saved = localStorage.getItem('paneChatHistory');
    return saved ? JSON.parse(saved) : {};
  });
  const [paneThinkingState, setPaneThinkingState] = useState<Record<string, boolean>>({});
  const [paneAgentPrompt, setPaneAgentPrompt] = useState<Record<string, string>>({});
  const [paneAgentAction, setPaneAgentAction] = useState<Record<string, AgentAction>>({});
  const [paneAgentRunning, setPaneAgentRunning] = useState<Record<string, boolean>>({});
  const [paneAgentResponse, setPaneAgentResponse] = useState<Record<string, AgentResponse | null>>({});
  const [paneAgentError, setPaneAgentError] = useState<Record<string, string>>({});
  const [paneRagContext, setPaneRagContext] = useState<Record<string, string[]>>({});
  const [paneCommandHistory, setPaneCommandHistory] = useState<Record<string, string[]>>({});
  
  // AI Configuration state
  const [aiConfig, setAiConfig] = useState<AiConfig>(() => {
    const saved = localStorage.getItem('aiConfig');
    return saved ? JSON.parse(saved) : {
      provider: 'ollama' as const,
      model: 'llama3',
      ollamaBaseUrl: 'http://localhost:11434',
      apiKey: '',
      maxContextTokens: 8192,
    };
  });

  useEffect(() => {
    localStorage.setItem('paneChatHistory', JSON.stringify(paneChatHistory));
  }, [paneChatHistory]);

  // Save AI config to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('aiConfig', JSON.stringify(aiConfig));
  }, [aiConfig]);

  const currentState = useMemo(
    () => ({
      currentChatHistory: paneChatHistory[activePaneId] ?? [{ role: 'assistant', content: welcomeMessage }],
      isThinking: paneThinkingState[activePaneId] ?? false,
      currentAgentPrompt: paneAgentPrompt[activePaneId] ?? '',
      currentAgentAction: paneAgentAction[activePaneId] ?? 'analyze_error',
      currentAgentRunning: paneAgentRunning[activePaneId] ?? false,
      currentAgentResponse: paneAgentResponse[activePaneId] ?? null,
      currentAgentError: paneAgentError[activePaneId] ?? '',
      currentRagContext: paneRagContext[activePaneId] ?? [],
      currentCommandHistory: paneCommandHistory[activePaneId] ?? [],
    }),
    [
      activePaneId,
      paneChatHistory,
      paneThinkingState,
      paneAgentPrompt,
      paneAgentAction,
      paneAgentRunning,
      paneAgentResponse,
      paneAgentError,
      paneRagContext,
      paneCommandHistory,
      welcomeMessage,
    ]
  );

  const recordTerminalLine = (paneId: string, line: string) => {
    if (!line) return;
    setPaneRagContext(prev => ({
      ...prev,
      [paneId]: [...(prev[paneId] ?? []).slice(-200), line],
    }));
    setPaneCommandHistory(prev => ({
      ...prev,
      [paneId]: [...(prev[paneId] ?? []).slice(-50), line],
    }));
  };

  const removePaneState = (paneId: string) => {
    const removePaneScopedState = <T,>(state: Record<string, T>) => {
      const next = { ...state };
      delete next[paneId];
      return next;
    };

    setPaneChatHistory(prev => removePaneScopedState(prev));
    setPaneThinkingState(prev => removePaneScopedState(prev));
    setPaneAgentPrompt(prev => removePaneScopedState(prev));
    setPaneAgentAction(prev => removePaneScopedState(prev));
    setPaneAgentRunning(prev => removePaneScopedState(prev));
    setPaneAgentResponse(prev => removePaneScopedState(prev));
    setPaneAgentError(prev => removePaneScopedState(prev));
    setPaneRagContext(prev => removePaneScopedState(prev));
    setPaneCommandHistory(prev => removePaneScopedState(prev));
  };

  return {
    paneChatHistory,
    setPaneChatHistory,
    paneThinkingState,
    setPaneThinkingState,
    paneAgentPrompt,
    setPaneAgentPrompt,
    paneAgentAction,
    setPaneAgentAction,
    paneAgentRunning,
    setPaneAgentRunning,
    paneAgentResponse,
    setPaneAgentResponse,
    paneAgentError,
    setPaneAgentError,
    paneRagContext,
    setPaneRagContext,
    paneCommandHistory,
    setPaneCommandHistory,
    aiConfig,
    setAiConfig,
    ...currentState,
    recordTerminalLine,
    removePaneState,
  };
}
