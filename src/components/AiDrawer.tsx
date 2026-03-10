import { AnimatePresence, motion } from 'framer-motion';
import { Image as ImageIcon, Loader2, PlugZap, Send, X } from 'lucide-react';
import { ChatMessage as ChatMessageType } from '../lib/tauri';
import { AgentAction, AgentResponse, SessionContext } from '../lib/domain';
import { AgentPanel } from './AgentPanel';

interface AiDrawerProps {
  open: boolean;
  title: string;
  models: string[];
  selectedModel: string;
  onSelectModel: (model: string) => void;
  onClose: () => void;
  chatHistory: ChatMessageType[];
  isThinking: boolean;
  chatInput: string;
  onChatInputChange: (value: string) => void;
  onSendMessage: () => void;
  ragContext: string[];
  contextConnectedLabel: string;
  contextEmptyLabel: string;
  thinkingLabel: string;
  inputPlaceholder: string;
  sessionContext: SessionContext;
  agentAction: AgentAction;
  agentPrompt: string;
  agentRunning: boolean;
  agentResponse: AgentResponse | null;
  agentError: string;
  aiProvider?: string;
  aiModel?: string;
  onAgentActionChange: (action: AgentAction) => void;
  onAgentPromptChange: (prompt: string) => void;
  onRunAgent: () => void;
}

export function AiDrawer({
  open,
  title,
  models,
  selectedModel,
  onSelectModel,
  onClose,
  chatHistory,
  isThinking,
  chatInput,
  onChatInputChange,
  onSendMessage,
  ragContext,
  contextConnectedLabel,
  contextEmptyLabel,
  thinkingLabel,
  inputPlaceholder,
  sessionContext,
  agentAction,
  agentPrompt,
  agentRunning,
  agentResponse,
  agentError,
  aiProvider = 'ollama',
  aiModel,
  onAgentActionChange,
  onAgentPromptChange,
  onRunAgent,
}: AiDrawerProps) {
  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'openai': return '🤖';
      case 'anthropic': return '🧠';
      case 'ollama': 
      default: return '🦙';
    }
  };

  const getProviderName = (provider: string) => {
    switch (provider) {
      case 'openai': return 'OpenAI';
      case 'anthropic': return 'Anthropic';
      case 'ollama': 
      default: return 'Ollama';
    }
  };

  const displayModel = aiModel || selectedModel;
  const isOnline = aiProvider === 'ollama' ? models.length > 0 : true;
  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 360, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 360, damping: 38 }}
          className="bg-[#08080E]/95 backdrop-blur-3xl border-l border-white/[0.04] flex flex-col overflow-hidden shadow-[-4px_0_30px_rgba(0,0,0,0.4)]"
        >
          <div className="h-14 border-b border-white/[0.05] flex items-center px-4 gap-3 shrink-0">
            <div className="w-2 h-2 rounded-full bg-violet-400 shadow-[0_0_10px_rgba(167,139,250,0.9)]" />
            <span className="text-sm font-semibold text-white">{title}</span>
            <div className="ml-auto flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                <span>{getProviderIcon(aiProvider)}</span>
                <span>{getProviderName(aiProvider)}</span>
              </div>
              {aiProvider === 'ollama' && models.length > 0 ? (
                <select
                  value={selectedModel}
                  onChange={e => onSelectModel(e.target.value)}
                  className="text-[11px] bg-[#12121A] border border-white/10 text-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:border-violet-500/40 transition-colors cursor-pointer"
                >
                  {models.map(model => <option key={model}>{model}</option>)}
                </select>
              ) : aiProvider !== 'ollama' ? (
                <span className="text-[10px] text-gray-400 bg-white/5 border border-white/10 px-2 py-1 rounded-lg">
                  {displayModel}
                </span>
              ) : (
                <span className="text-[10px] text-yellow-500/70 bg-yellow-500/10 border border-yellow-500/15 px-2 py-1 rounded-full flex items-center gap-1">
                  <PlugZap size={10} /> Ollama offline
                </span>
              )}
            </div>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-600 hover:text-white hover:bg-white/5 transition-colors ml-1">
              <X size={15} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {chatHistory.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                className={`text-[13px] leading-relaxed ${
                  msg.role === 'user'
                    ? 'ml-8 bg-violet-600 border border-violet-500/30 text-white rounded-2xl rounded-tr-md px-4 py-2.5 shadow-md'
                    : 'mr-8 bg-white/[0.04] border border-white/[0.06] text-gray-200 rounded-2xl rounded-tl-md px-4 py-2.5'
                }`}
                style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
              >
                {msg.content}
              </motion.div>
            ))}
            {isThinking && (
              <div className="mr-8 bg-white/[0.04] border border-white/[0.06] text-gray-500 rounded-2xl rounded-tl-md px-4 py-3 text-sm flex items-center gap-3">
                {[0, 1, 2].map(d => (
                  <motion.span
                    key={d}
                    className="w-1.5 h-1.5 bg-violet-500 rounded-full inline-block"
                    animate={{ y: [0, -5, 0] }}
                    transition={{ repeat: Infinity, delay: d * 0.18, duration: 0.7 }}
                  />
                ))}
                <span className="text-xs">{thinkingLabel}</span>
              </div>
            )}
          </div>

          <AgentPanel
            ragContext={ragContext}
            sessionContext={sessionContext}
            online={isOnline}
            action={agentAction}
            prompt={agentPrompt}
            running={agentRunning}
            response={agentResponse}
            error={agentError}
            onActionChange={onAgentActionChange}
            onPromptChange={onAgentPromptChange}
            onRun={onRunAgent}
          />

          <div className="p-4 border-t border-white/[0.05] space-y-2 shrink-0">
            <div className="flex items-center gap-2 text-[11px] font-medium">
              <div className={`w-1.5 h-1.5 rounded-full ${ragContext.length > 0 ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]' : 'bg-gray-700'}`} />
              <span className="text-gray-600">
                {ragContext.length > 0 ? `${contextConnectedLabel} · ${ragContext.length}L` : contextEmptyLabel}
              </span>
            </div>
            <div className="flex items-end gap-2 bg-[#05050A] rounded-2xl border border-white/[0.07] hover:border-violet-500/20 focus-within:border-violet-500/50 focus-within:shadow-[0_0_20px_rgba(139,92,246,0.07)] transition-all p-1.5 pl-3">
              <button className="text-gray-700 hover:text-violet-400 transition-colors p-2 mb-0.5">
                <ImageIcon size={16} />
              </button>
              <input
                type="text"
                value={chatInput}
                onChange={e => onChatInputChange(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && onSendMessage()}
                placeholder={inputPlaceholder}
                className="flex-1 bg-transparent outline-none text-[13px] text-white placeholder-gray-700 py-2.5"
              />
              <button
                onClick={onSendMessage}
                disabled={!chatInput.trim() || isThinking}
                className="p-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 active:scale-95 disabled:opacity-25 disabled:cursor-not-allowed transition-all shadow-lg"
              >
                {isThinking ? <Loader2 size={15} className="text-white animate-spin" /> : <Send size={15} className="text-white" />}
              </button>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
