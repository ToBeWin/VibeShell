import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Bot, Loader2, PlugZap, Sparkles, TerminalSquare, Wrench } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AgentAction, AgentResponse, SessionContext } from '../lib/domain';

interface AgentPanelProps {
  ragContext: string[];
  sessionContext: SessionContext;
  online: boolean;
  hasContext?: boolean;
  compact?: boolean;
  action: AgentAction;
  prompt: string;
  running: boolean;
  response: AgentResponse | null;
  error: string;
  onActionChange: (action: AgentAction) => void;
  onPromptChange: (prompt: string) => void;
  onRun: () => void;
}

export function AgentPanel({
  ragContext,
  sessionContext,
  online,
  hasContext = false,
  compact = false,
  action,
  prompt,
  running,
  response,
  error,
  onActionChange,
  onPromptChange,
  onRun,
}: AgentPanelProps) {
  const { t } = useTranslation();
  const mergedContext = useMemo<SessionContext>(() => ({
    ...sessionContext,
    recentOutput: ragContext.slice(-80),
    recentCommands: sessionContext.recentCommands.slice(-20),
  }), [sessionContext, ragContext]);
  const actions: { id: AgentAction; label: string; hint: string; icon: typeof Sparkles }[] = [
    { id: 'explain_command', label: t('ai.actions.explainCommand'), hint: t('ai.actions.explainCommandHint'), icon: TerminalSquare },
    { id: 'analyze_error', label: t('ai.actions.analyzeError'), hint: t('ai.actions.analyzeErrorHint'), icon: Wrench },
    { id: 'analyze_logs', label: t('ai.actions.analyzeLogs'), hint: t('ai.actions.analyzeLogsHint'), icon: Bot },
    { id: 'generate_shell_script', label: t('ai.actions.shellScript'), hint: t('ai.actions.shellScriptHint'), icon: Sparkles },
    { id: 'generate_python_script', label: t('ai.actions.pythonScript'), hint: t('ai.actions.pythonScriptHint'), icon: Sparkles },
    { id: 'session_aware_chat', label: t('ai.actions.sessionQa'), hint: t('ai.actions.sessionQaHint'), icon: Bot },
  ];
  const statusLabel = !online
    ? t('ai.agentOffline')
    : hasContext
      ? t('ai.agentOnline')
      : t('ai.agentWaitingContext');
  const contextSummary = hasContext
    ? `${mergedContext.host ? `${mergedContext.user}@${mergedContext.host}` : t('ai.terminalConnected')} · ${t('ai.contextLines', { count: mergedContext.recentOutput.length })}`
    : t('ai.contextRequired');
  const runLabel = hasContext ? t('ai.runAgent') : t('ai.contextRequiredAction');
  const runDisabled = !prompt.trim() || running || !online || !hasContext;

  return (
    <div className="border-t border-white/[0.05]" style={{ background: 'color-mix(in srgb, var(--panel-bg) 72%, transparent)' }}>
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-gray-600">
          <Sparkles size={12} className="text-violet-400" />
          {t('ai.agentActions')}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(compact ? actions.slice(0, 2) : actions).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onActionChange(item.id)}
                className={`rounded-xl border px-3 py-2.5 text-left transition-all ${
                  action === item.id
                    ? 'border-violet-400/30 bg-violet-500/10 text-violet-200'
                    : 'border-white/[0.06] bg-white/[0.02] text-gray-400 hover:text-gray-200 hover:bg-white/[0.05]'
                }`}
              >
                <div className="flex items-center gap-2 text-[12px] font-medium">
                  <Icon size={13} />
                  {item.label}
                </div>
                {!compact && (
                  <div className="mt-1 text-[11px] leading-relaxed text-gray-500">{item.hint}</div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 pb-4 space-y-3">
        <div className="rounded-2xl border border-white/[0.06] bg-[#040409] p-3">
          <div className="mb-2 flex items-center gap-2 text-[11px] text-gray-500">
            <PlugZap size={11} className={online ? 'text-green-400' : 'text-yellow-500'} />
            {statusLabel}
          </div>
          <textarea
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            placeholder={hasContext ? t('ai.quickPromptBody') : t('ai.quickPromptPlaceholder')}
            className={`w-full resize-none bg-transparent text-[13px] text-gray-200 outline-none placeholder:text-gray-700 ${compact ? 'min-h-[64px]' : 'min-h-[92px]'}`}
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="text-[11px] text-gray-600">{contextSummary}</div>
            <button
              onClick={onRun}
              disabled={runDisabled}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-3 py-2 text-[12px] font-medium text-white transition-all hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-30"
            >
              {running ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              {running ? t('ai.running') : runLabel}
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-[12px] text-red-300">
            {error}
          </div>
        )}

        {response && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4"
          >
            <div className="text-sm font-semibold text-white">{response.title}</div>
            <div className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-gray-300">{response.summary}</div>
            {response.suggestedCommand && (
              <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-emerald-400">{t('ai.suggestedCommand')}</div>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-[12px] text-emerald-100">{response.suggestedCommand}</pre>
              </div>
            )}
            {response.suggestedScript && (
              <div className="mt-3 rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-300">{t('ai.suggestedScript')}</div>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-[12px] text-cyan-50">{response.suggestedScript}</pre>
              </div>
            )}
            {response.warnings.length > 0 && (
              <div className="mt-3 rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-yellow-300">{t('ai.warnings')}</div>
                <ul className="mt-2 space-y-1 text-[12px] text-yellow-50">
                  {response.warnings.map((warning, index) => <li key={index}>{warning}</li>)}
                </ul>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
