import { Plus, X } from 'lucide-react';
import { LocalServer } from './WorkspaceSidebar';

interface WorkspaceTabsProps {
  sessions: LocalServer[];
  activeSessionId: string;
  onSelectSession: (sessionId: string) => void;
  onAddSession: () => void;
  onRemoveSession: (sessionId: string) => void;
}

export function WorkspaceTabs({
  sessions,
  activeSessionId,
  onSelectSession,
  onAddSession,
  onRemoveSession,
}: WorkspaceTabsProps) {
  return (
    <div className="overflow-x-auto border-b border-white/[0.05] bg-[#090a10]/88 px-5 py-2 backdrop-blur-2xl scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
      <div className="flex min-w-max items-center gap-2">
      {sessions.map((session, index) => (
        <div
          key={session.id}
          role="button"
          tabIndex={0}
          onClick={() => onSelectSession(session.id)}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onSelectSession(session.id);
            }
          }}
          className={`group relative flex shrink-0 items-center gap-3 rounded-xl border px-3.5 py-2 text-left transition-all ${
            activeSessionId === session.id
              ? 'border-cyan-300/10 bg-cyan-400/[0.06] text-white'
              : 'border-white/[0.06] bg-white/[0.02] text-gray-400 hover:border-white/[0.1] hover:bg-white/[0.04] hover:text-gray-200'
          }`}
        >
          <div className={`h-2.5 w-2.5 rounded-full ${session.connected ? 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.5)]' : 'bg-gray-600'}`} />
          <div className="min-w-0">
            <div className="max-w-[180px] truncate text-[12px] font-semibold tracking-[0.01em]">{session.name}</div>
            <div className="max-w-[180px] truncate text-[10px] font-mono text-gray-500">{session.user}@{session.host}</div>
          </div>
          {index < 9 && (
            <kbd className="rounded-md border border-white/[0.06] bg-black/20 px-1.5 py-0.5 text-[9px] text-gray-600">
              ⌘{index + 1}
            </kbd>
          )}
          <button
            onClick={event => {
              event.stopPropagation();
              onRemoveSession(session.id);
            }}
            className="rounded-md p-0.5 text-gray-600 opacity-0 transition-all hover:bg-white/10 hover:text-white group-hover:opacity-100"
          >
            <X size={12} />
          </button>
        </div>
      ))}
      <button
        onClick={onAddSession}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-dashed border-cyan-300/12 bg-cyan-400/[0.03] text-gray-500 transition-all hover:border-cyan-300/25 hover:bg-cyan-400/[0.08] hover:text-white"
      >
        <Plus size={16} />
      </button>
      </div>
    </div>
  );
}
