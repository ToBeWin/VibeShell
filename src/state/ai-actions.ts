import { AgentAction, AgentResponse, SessionContext } from '../lib/domain';
import { aiChatStreamWithConfig, ChatMessage, runAgentTask } from '../lib/tauri';
import { AiConfig } from './ai';
import i18n from '../i18n';

interface UseAiActionsOptions {
  activePaneId: string;
  ollamaModel: string;
  ollamaUrl: string;
  inputText: string;
  setInputText: React.Dispatch<React.SetStateAction<string>>;
  currentChatHistory: ChatMessage[];
  currentRagContext: string[];
  isThinking: boolean;
  currentAgentPrompt: string;
  currentAgentAction: AgentAction;
  currentAgentRunning: boolean;
  sessionContext: SessionContext;
  welcomeMessage: string;
  aiConfig: AiConfig;
  setPaneChatHistory: React.Dispatch<React.SetStateAction<Record<string, ChatMessage[]>>>;
  setPaneThinkingState: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setPaneAgentRunning: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setPaneAgentResponse: React.Dispatch<React.SetStateAction<Record<string, AgentResponse | null>>>;
  setPaneAgentError: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

export function useAiActions({
  activePaneId,
  ollamaModel,
  ollamaUrl,
  inputText,
  setInputText,
  currentChatHistory,
  currentRagContext,
  isThinking,
  currentAgentPrompt,
  currentAgentAction,
  currentAgentRunning,
  sessionContext,
  welcomeMessage,
  aiConfig,
  setPaneChatHistory,
  setPaneThinkingState,
  setPaneAgentRunning,
  setPaneAgentResponse,
  setPaneAgentError,
}: UseAiActionsOptions) {
  const sendMessage = async () => {
    if (!inputText.trim() || isThinking) return;

    const userMsg: ChatMessage = { role: 'user', content: inputText };
    setPaneChatHistory(prev => ({
      ...prev,
      [activePaneId]: [...(prev[activePaneId] ?? [{ role: 'assistant', content: welcomeMessage }]), userMsg, { role: 'assistant', content: '' }],
    }));
    setInputText('');
    setPaneThinkingState(prev => ({ ...prev, [activePaneId]: true }));

    const systemMsg: ChatMessage = {
      role: 'system',
      content: currentRagContext.length > 0
        ? `You are VibeShell AI. Terminal context:\n\`\`\`\n${currentRagContext.slice(-50).join('\n')}\n\`\`\`\nBe concise and actionable.`
        : 'You are VibeShell AI, an expert terminal assistant.',
    };

    try {
      // Use the configured AI provider with full config support
      const provider = aiConfig.provider;
      const model = aiConfig.provider === 'ollama' ? ollamaModel : aiConfig.model;
      const baseUrl = aiConfig.provider === 'ollama' ? ollamaUrl : aiConfig.ollamaBaseUrl;
      const apiKey = aiConfig.provider !== 'ollama' ? aiConfig.apiKey : undefined;
      
      await aiChatStreamWithConfig(
        provider,
        model,
        baseUrl,
        apiKey,
        aiConfig.maxContextTokens,
        [systemMsg, ...currentChatHistory.filter(message => message.role !== 'system'), userMsg],
        (chunk) => {
          setPaneThinkingState(prev => ({ ...prev, [activePaneId]: false }));
          setPaneChatHistory(prev => {
            const history = [...(prev[activePaneId] ?? [])];
            history[history.length - 1] = {
              ...history[history.length - 1],
              content: history[history.length - 1].content + chunk,
            };
            return { ...prev, [activePaneId]: history };
          });
        }
      );
    } catch (error) {
      setPaneThinkingState(prev => ({ ...prev, [activePaneId]: false }));
      setPaneChatHistory(prev => {
        const history = [...(prev[activePaneId] ?? [])];
        const providerLabel = aiConfig.provider.toUpperCase();
        const errorMessage = aiConfig.provider === 'ollama' 
          ? `⚠️ ${error}\n\n${i18n.t('ai.errors.ollamaHint')}`
          : `⚠️ ${error}\n\n${i18n.t('ai.errors.providerHint', { provider: providerLabel })}`;
        history[history.length - 1] = {
          ...history[history.length - 1],
          content: errorMessage,
        };
        return { ...prev, [activePaneId]: history };
      });
    }
  };

  const runAgentForActivePane = async () => {
    if (!currentAgentPrompt.trim() || currentAgentRunning) return;

    setPaneAgentRunning(prev => ({ ...prev, [activePaneId]: true }));
    setPaneAgentError(prev => ({ ...prev, [activePaneId]: '' }));

    try {
      // Use the configured AI provider
      const provider = aiConfig.provider;
      const model = aiConfig.provider === 'ollama' ? ollamaModel : aiConfig.model;
      const baseUrl = aiConfig.provider === 'ollama' ? ollamaUrl : aiConfig.ollamaBaseUrl;
      
      const result = await runAgentTask(provider, model, baseUrl, {
        action: currentAgentAction,
        userInput: currentAgentPrompt,
        context: sessionContext,
      });
      setPaneAgentResponse(prev => ({ ...prev, [activePaneId]: result }));
    } catch (error) {
      setPaneAgentError(prev => ({ ...prev, [activePaneId]: String(error) }));
    } finally {
      setPaneAgentRunning(prev => ({ ...prev, [activePaneId]: false }));
    }
  };

  return {
    sendMessage,
    runAgentForActivePane,
  };
}
