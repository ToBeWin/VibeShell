import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Image as ImageIcon, Loader2, MessageSquare, PlugZap, Send, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChatMessage as ChatMessageType, listOllamaModels, startOllamaService } from '../lib/tauri';
import { AgentAction, AgentResponse, SessionContext } from '../lib/domain';
import { AgentPanel } from './AgentPanel';

interface AiDrawerProps {
  open: boolean;
  width: number;
  title: string;
  models: string[];
  selectedModel: string;
  onSelectModel: (model: string) => void;
  onClose: () => void;
  onWidthChange: (width: number) => void;
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
  aiBaseUrl?: string;
  onAgentActionChange: (action: AgentAction) => void;
  onAgentPromptChange: (prompt: string) => void;
  onRunAgent: () => void;
}

const MIN_DRAWER_WIDTH = 320;
const MAX_DRAWER_WIDTH = 720;

function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="ai-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code(props) {
            const { className, children, ...rest } = props as {
              className?: string;
              children?: React.ReactNode;
            };
            const textContent = String(children ?? '');
            const isBlock = Boolean(className) || textContent.includes('\n');

            if (!isBlock) {
              return (
                <code className="rounded-md bg-black/30 px-1.5 py-0.5 font-mono text-[0.92em] text-cyan-100" {...rest}>
                  {children}
                </code>
              );
            }

            return (
              <pre className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#05050A] p-3 text-[12px] leading-6 text-gray-100">
                <code className={className} {...rest}>
                  {children}
                </code>
              </pre>
            );
          },
          table({ children }) {
            return (
              <div className="my-4 overflow-x-auto rounded-2xl border border-white/[0.08]">
                <table className="w-max min-w-full border-collapse text-left text-[12px]">{children}</table>
              </div>
            );
          },
          th({ children }) {
            return <th className="border-b border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[11px] font-semibold text-white whitespace-nowrap">{children}</th>;
          },
          td({ children }) {
            return <td className="min-w-[120px] border-b border-white/[0.06] px-3 py-2 align-top text-gray-200 whitespace-nowrap">{children}</td>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export function AiDrawer({
  open,
  width,
  title,
  models,
  selectedModel,
  onSelectModel,
  onClose,
  onWidthChange,
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
  aiBaseUrl = '',
  onAgentActionChange,
  onAgentPromptChange,
  onRunAgent,
}: AiDrawerProps) {
  const { t } = useTranslation();
  const [resolvedModels, setResolvedModels] = useState<string[]>(models);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeOrigin, setResizeOrigin] = useState<{ x: number; width: number } | null>(null);
  const normalizeUrl = (url: string) => url.toLowerCase().trim();

  const getProviderDisplay = (provider: string, baseUrl: string) => {
    const url = normalizeUrl(baseUrl);
    if (provider === 'ollama') return { icon: '�', name: 'Ollama' };
    if (provider === 'anthropic') return { icon: '🧠', name: 'Anthropic' };
    if (url.includes('deepseek')) return { icon: '🔍', name: 'DeepSeek' };
    if (url.includes('dashscope') || url.includes('qwen')) return { icon: '🌊', name: 'Qwen' };
    if (url.includes('bigmodel') || url.includes('glm')) return { icon: '🧬', name: 'GLM' };
    if (url.includes('minimax') || url.includes('minimaxi')) return { icon: '⚡', name: 'MiniMax' };
    if (url.includes('generativelanguage') || url.includes('gemini')) return { icon: '✨', name: 'Gemini' };
    if (url.includes('moonshot') || url.includes('kimi')) return { icon: '🌙', name: 'Kimi' };
    return { icon: '🤖', name: 'OpenAI Compatible' };
  };

  useEffect(() => {
    setResolvedModels(models);
  }, [models]);

  useEffect(() => {
    if (aiProvider !== 'ollama') {
      return;
    }

    let cancelled = false;
    const baseUrl = (aiBaseUrl || 'http://localhost:11434').trim();

    const refreshModels = async () => {
      try {
        const nextModels = await listOllamaModels(baseUrl);
        if (!cancelled) {
          setResolvedModels(nextModels);
        }
        return;
      } catch {}

      try {
        const nextModels = await startOllamaService(baseUrl);
        if (!cancelled) {
          setResolvedModels(nextModels);
        }
      } catch {
        if (!cancelled) {
          setResolvedModels([]);
        }
      }
    };

    refreshModels();

    return () => {
      cancelled = true;
    };
  }, [aiBaseUrl, aiProvider]);

  const displayModel = aiModel || selectedModel;
  const activeOllamaModels = aiProvider === 'ollama' ? resolvedModels : models;
  const isOnline = aiProvider === 'ollama' ? activeOllamaModels.length > 0 : true;
  const providerDisplay = getProviderDisplay(aiProvider, aiBaseUrl);
  const hasLiveContext = sessionContext.contextKind === 'terminal' || sessionContext.contextKind === 'files' || ragContext.length > 0;
  const isCompact = !hasLiveContext;
  const compactCanSend = Boolean(chatInput.trim()) && !isThinking && isOnline;
  const quickActions: AgentAction[] = ['explain_command', 'analyze_error', 'analyze_logs'];
  const actionLabels: Record<AgentAction, string> = {
    explain_command: t('ai.actions.explainCommand'),
    analyze_error: t('ai.actions.analyzeError'),
    analyze_logs: t('ai.actions.analyzeLogs'),
    generate_shell_script: t('ai.actions.shellScript'),
    generate_python_script: t('ai.actions.pythonScript'),
    session_aware_chat: t('ai.actions.sessionQa'),
  };
  const contextSourceLabel = sessionContext.contextKind === 'terminal'
    ? t('ai.contextSourceTerminal')
    : sessionContext.contextKind === 'files'
      ? t('ai.contextSourceFiles')
      : t('ai.contextSourceWorkspace');
  const drawerWidth = Math.min(MAX_DRAWER_WIDTH, Math.max(MIN_DRAWER_WIDTH, width));

  useEffect(() => {
    if (!resizeOrigin) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      const nextWidth = resizeOrigin.width + (resizeOrigin.x - event.clientX);
      onWidthChange(Math.min(MAX_DRAWER_WIDTH, Math.max(MIN_DRAWER_WIDTH, nextWidth)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setResizeOrigin(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [onWidthChange, resizeOrigin]);

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: drawerWidth, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 360, damping: 38 }}
          className={`relative backdrop-blur-3xl border-l flex flex-col overflow-hidden shadow-[-4px_0_30px_rgba(0,0,0,0.4)] ${isResizing ? 'select-none' : ''}`}
          style={{ background: 'color-mix(in srgb, var(--panel-bg) 95%, black)', borderColor: 'var(--panel-border)' }}
        >
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label={t('ai.resizeDrawer', 'Resize AI drawer')}
            onMouseDown={(event) => {
              event.preventDefault();
              setIsResizing(true);
              setResizeOrigin({ x: event.clientX, width: drawerWidth });
            }}
            className="absolute inset-y-0 left-0 z-20 w-3 -translate-x-1.5 cursor-col-resize"
          >
            <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/[0.04]" />
            <div className="absolute left-1/2 top-1/2 h-14 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.08] transition-colors hover:bg-cyan-300/35" />
          </div>

          <div className="h-14 border-b border-white/[0.05] flex items-center px-4 gap-3 shrink-0">
            <div className="w-2 h-2 rounded-full bg-violet-400 shadow-[0_0_10px_rgba(167,139,250,0.9)]" />
            <span className="text-sm font-semibold text-white">{title}</span>
            <div className="ml-auto flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                <span>{providerDisplay.icon}</span>
                <span>{providerDisplay.name}</span>
              </div>
              {aiProvider === 'ollama' && activeOllamaModels.length > 0 ? (
                <select
                  value={activeOllamaModels.includes(selectedModel) ? selectedModel : (activeOllamaModels[0] ?? '')}
                  onChange={e => onSelectModel(e.target.value)}
                  className="text-[11px] bg-[#12121A] border border-white/10 text-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:border-violet-500/40 transition-colors cursor-pointer"
                >
                  {activeOllamaModels.map(model => <option key={model}>{model}</option>)}
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

          {isCompact ? (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="rounded-3xl border border-white/[0.06] bg-white/[0.03] p-5">
                  <div className="text-sm font-semibold text-white">{t('ai.assistantReady')}</div>
                  <div className="mt-2 text-[13px] leading-7 text-gray-400">
                    {t('ai.compactBody')}
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-[11px] text-gray-500">
                    <div className={`h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-yellow-500/70'}`} />
                    {isOnline ? t('ai.modelAvailable') : t('ai.modelOffline')}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/[0.06] bg-[#040409] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-gray-600">{t('ai.contextTitle')}</div>
                    <div className="rounded-full border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 text-[10px] text-gray-400">
                      {t('ai.contextPending')}
                    </div>
                  </div>
                  <div className="mt-3 space-y-2">
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-gray-600">{t('ai.contextSource')}</div>
                      <div className="mt-1 text-[12px] text-gray-300">{contextSourceLabel}</div>
                    </div>
                    <div className="text-[12px] leading-6 text-gray-500">
                      {t('ai.noContextActions')}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {quickActions.map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => onAgentActionChange(item)}
                          className={`rounded-full border px-3 py-1.5 text-[11px] transition-all ${
                            agentAction === item
                              ? 'border-violet-400/30 bg-violet-500/10 text-violet-200'
                              : 'border-white/[0.06] bg-white/[0.02] text-gray-500'
                          }`}
                        >
                          {actionLabels[item]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {(chatHistory.length > 0 || isThinking) ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-gray-600">
                      <MessageSquare size={12} className="text-violet-400" />
                      {t('ai.quickPrompt')}
                    </div>
                    {chatHistory.map((msg, i) => (
                      <motion.div
                        key={`compact-${i}`}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`text-[12px] leading-relaxed ${
                          msg.role === 'user'
                            ? 'ml-8 rounded-2xl rounded-tr-md border border-violet-500/30 bg-violet-600 px-3 py-2 text-white'
                            : 'mr-4 rounded-2xl rounded-tl-md border border-white/[0.06] bg-white/[0.04] px-3 py-2 text-gray-200'
                        }`}
                        style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                      >
                        {msg.role === 'user' ? msg.content : <MarkdownMessage content={msg.content} />}
                      </motion.div>
                    ))}
                    {isThinking && (
                      <div className="mr-4 flex items-center gap-3 rounded-2xl rounded-tl-md border border-white/[0.06] bg-white/[0.04] px-3 py-2.5 text-xs text-gray-400">
                        {[0, 1, 2].map((d) => (
                          <motion.span
                            key={`compact-thinking-${d}`}
                            className="inline-block h-1.5 w-1.5 rounded-full bg-violet-500"
                            animate={{ y: [0, -4, 0] }}
                            transition={{ repeat: Infinity, delay: d * 0.18, duration: 0.7 }}
                          />
                        ))}
                        <span>{thinkingLabel}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/[0.08] bg-[#040409] px-4 py-5">
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-gray-600">
                      <MessageSquare size={12} className="text-violet-400" />
                      {t('ai.quickPrompt')}
                    </div>
                    <div className="mt-2 text-[12px] leading-6 text-gray-500">
                      {t('ai.quickPromptBody')}
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-white/[0.05] p-4 shrink-0">
                <div className="flex items-end gap-2 rounded-2xl border border-white/[0.07] bg-[#05050A] p-1.5 pl-3 transition-all hover:border-violet-500/20 focus-within:border-violet-500/50 focus-within:shadow-[0_0_20px_rgba(139,92,246,0.07)]">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={e => onChatInputChange(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && compactCanSend && onSendMessage()}
                    placeholder={t('ai.quickPromptPlaceholder')}
                    className="flex-1 bg-transparent py-2.5 text-[13px] text-white outline-none placeholder:text-gray-700"
                  />
                  <button
                    onClick={onSendMessage}
                    disabled={!compactCanSend}
                    className="rounded-xl bg-violet-600 p-2.5 text-white transition-all hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-25"
                  >
                    {isThinking ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <>
                <div className="rounded-3xl border border-white/[0.06] bg-white/[0.03] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.18em] text-gray-600">{t('ai.contextTitle')}</div>
                      <div className="mt-2 text-sm font-semibold text-white">
                        {sessionContext.host ? `${sessionContext.user}@${sessionContext.host}` : t('ai.assistantReady')}
                      </div>
                    </div>
                    <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] text-emerald-300">
                      {ragContext.length > 0 ? `${contextConnectedLabel} · ${ragContext.length}L` : contextEmptyLabel}
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <div className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-gray-600">{t('ai.contextHost')}</div>
                      <div className="mt-1 truncate text-[12px] text-gray-200">{sessionContext.host || '--'}</div>
                    </div>
                    <div className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-gray-600">{t('ai.contextPath')}</div>
                      <div className="mt-1 truncate text-[12px] text-gray-200">{sessionContext.filePath || sessionContext.cwd || '/'}</div>
                    </div>
                    <div className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-gray-600">{t('ai.contextSource')}</div>
                      <div className="mt-1 truncate text-[12px] text-gray-200">{contextSourceLabel}</div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-gray-600">{t('ai.suggestedNext')}</div>
                    <div className="flex flex-wrap gap-2">
                      {quickActions.map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => onAgentActionChange(item)}
                          className={`rounded-full border px-3 py-1.5 text-[11px] transition-all ${
                            agentAction === item
                              ? 'border-violet-400/30 bg-violet-500/10 text-violet-200'
                              : 'border-white/[0.06] bg-white/[0.02] text-gray-400 hover:bg-white/[0.05] hover:text-gray-200'
                          }`}
                        >
                          {actionLabels[item]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

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
                    {msg.role === 'user' ? msg.content : <MarkdownMessage content={msg.content} />}
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
              </>
            </div>
          )}

          {!isCompact && (
            <>
              <AgentPanel
                ragContext={ragContext}
                sessionContext={sessionContext}
                online={isOnline}
                hasContext={hasLiveContext}
                compact={isCompact}
                action={agentAction}
                prompt={agentPrompt}
                running={agentRunning}
                response={agentResponse}
                error={agentError}
                onActionChange={onAgentActionChange}
                onPromptChange={onAgentPromptChange}
                onRun={onRunAgent}
              />

              <div className="space-y-2 border-t border-white/[0.05] p-4 shrink-0">
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
            </>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
