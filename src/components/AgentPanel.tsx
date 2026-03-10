import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Bot, Loader2, PlugZap, Sparkles, TerminalSquare, Wrench } from 'lucide-react';
import { AgentAction, AgentResponse, SessionContext } from '../lib/domain';

const ACTIONS: { id: AgentAction; label: string; hint: string; icon: typeof Sparkles }[] = [
  { id: 'explain_command', label: 'Explain Command', hint: 'Explain the current command and its risk', icon: TerminalSquare },
  { id: 'analyze_error', label: 'Analyze Error', hint: 'Diagnose failures from current output', icon: Wrench },
  { id: 'analyze_logs', label: 'Analyze Logs', hint: 'Summarize log patterns and likely root causes', icon: Bot },
  { id: 'generate_shell_script', label: 'Shell Script', hint: 'Generate a runnable shell script', icon: Sparkles },
  { id: 'generate_python_script', label: 'Python Script', hint: 'Generate a runnable Python script', icon: Sparkles },
  { id: 'session_aware_chat', label: 'Session Q&A', hint: 'Ask with active host and terminal context', icon: Bot },
];

interface AgentPanelProps {
  ragContext: string[];
  sessionContext: SessionContext;
  online: boolean;
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
  action,
  prompt,
  running,
  response,
  error,
  onActionChange,
  onPromptChange,
  onRun,
}: AgentPanelProps) {
  const mergedContext = useMemo<SessionContext>(() => ({
    ...sessionContext,
    recentOutput: ragContext.slice(-80),
    recentCommands: sessionContext.recentCommands.slice(-20),
  }), [sessionContext, ragContext]);

  return (
    <div className="border-t border-white/[0.05] bg-[#06060D]/60">
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-gray-600">
          <Sparkles size={12} className="text-violet-400" />
          Agent Actions
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {ACTIONS.map(item => {
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
                <div className="mt-1 text-[11px] leading-relaxed text-gray-500">{item.hint}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 pb-4 space-y-3">
        <div className="rounded-2xl border border-white/[0.06] bg-[#040409] p-3">
          <div className="mb-2 flex items-center gap-2 text-[11px] text-gray-500">
            <PlugZap size={11} className={online ? 'text-green-400' : 'text-yellow-500'} />
            {online ? `Agent online · pane context ready` : 'Agent offline'}
          </div>
          <textarea
            value={prompt}
            onChange={e => onPromptChange(e.target.value)}
            placeholder="Ask the agent to explain, diagnose, or generate a script..."
            className="min-h-[92px] w-full resize-none bg-transparent text-[13px] text-gray-200 outline-none placeholder:text-gray-700"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="text-[11px] text-gray-600">
              {mergedContext.host ? `${mergedContext.user}@${mergedContext.host}` : 'No active host'} · {mergedContext.recentOutput.length} context lines
            </div>
            <button
              onClick={onRun}
              disabled={!prompt.trim() || running || !online}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-3 py-2 text-[12px] font-medium text-white transition-all hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-30"
            >
              {running ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              {running ? 'Running…' : 'Run Agent'}
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
                <div className="text-[11px] uppercase tracking-[0.18em] text-emerald-400">Suggested Command</div>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-[12px] text-emerald-100">{response.suggestedCommand}</pre>
              </div>
            )}
            {response.suggestedScript && (
              <div className="mt-3 rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-300">Suggested Script</div>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-[12px] text-cyan-50">{response.suggestedScript}</pre>
              </div>
            )}
            {response.warnings.length > 0 && (
              <div className="mt-3 rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-yellow-300">Warnings</div>
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
