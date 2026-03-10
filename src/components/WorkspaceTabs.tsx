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
    <div className="flex items-center gap-2 overflow-x-auto px-4 py-3 border-b border-white/[0.05] bg-[#07070D]/60 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
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
          className={`group flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition-all relative ${
            activeSessionId === session.id
              ? 'border-violet-400/20 bg-violet-500/10 text-white'
              : 'border-white/[0.06] bg-white/[0.02] text-gray-400 hover:bg-white/[0.05] hover:text-gray-200'
          }`}
        >
          <div className={`h-2 w-2 rounded-full ${session.connected ? 'bg-green-400' : 'bg-gray-600'}`} />
          <div className="min-w-0">
            <div className="max-w-[180px] truncate text-[12px] font-medium">{session.name}</div>
            <div className="max-w-[180px] truncate text-[10px] font-mono text-gray-500">{session.user}@{session.host}</div>
          </div>
          {index < 9 && (
            <kbd className="text-[9px] text-gray-600 bg-white/[0.03] px-1 py-0.5 rounded border border-white/[0.06]">
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
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] text-gray-500 transition-all hover:bg-white/[0.05] hover:text-white"
      >
        <Plus size={16} />
      </button>
    </div>
  );
}
