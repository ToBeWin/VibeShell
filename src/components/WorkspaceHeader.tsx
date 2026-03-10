import { motion } from 'framer-motion';
import { Plus, X } from 'lucide-react';

interface WorkspaceHeaderProps {
  paneConnected: boolean;
  paneConnecting?: boolean;
  paneLabel: string;
  paneHost: string;
  panePort: number;
  onConnect: () => void;
  onCloseSession?: () => void;
  onAddSession?: () => void;
  onEnterZen: () => void;
}

export function WorkspaceHeader({
  paneConnected,
  paneConnecting = false,
  paneLabel,
  paneHost,
  panePort,
  onConnect,
  onCloseSession,
  onAddSession,
  onEnterZen,
}: WorkspaceHeaderProps) {
  return (
    <motion.div
      initial={{ y: -56, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -56, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 360, damping: 38 }}
      className="h-14 border-b border-white/[0.05] flex items-center px-5 gap-3 shrink-0"
    >
      <div className="flex items-center gap-2 bg-[#10101A]/70 backdrop-blur-xl border border-white/[0.08] px-4 py-2 rounded-xl text-sm text-white">
        <div className={`w-2 h-2 rounded-full ${paneConnected ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]' : paneConnecting ? 'bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.5)]' : 'bg-gray-700'}`} />
        <span className="font-medium">{paneLabel}</span>
        <div className="w-px h-4 bg-white/10 mx-1.5" />
        <span className="text-gray-500 text-xs font-mono">{paneHost}:{panePort}</span>
        {!paneConnected && (
          <button onClick={onConnect} disabled={paneConnecting} className="ml-2 text-[10px] bg-violet-600 hover:bg-violet-500 px-2 py-0.5 rounded text-white shadow-sm transition-all disabled:cursor-wait disabled:opacity-50">
            {paneConnecting ? 'Connecting...' : 'Connect'}
          </button>
        )}
        {onCloseSession && (
          <button
            onClick={onCloseSession}
            className="ml-3 rounded-md p-0.5 text-gray-600 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X size={13} />
          </button>
        )}
      </div>
      <button
        onClick={onAddSession}
        className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-600 hover:text-white hover:bg-white/5 transition-colors"
      >
        <Plus size={17} />
      </button>
      <div className="ml-auto flex items-center gap-3">
        <span
          className="text-xs text-gray-600 font-medium px-3 py-1.5 rounded-lg border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.05] cursor-pointer transition-colors"
          onClick={onEnterZen}
        >
          ⌘K Zen
        </span>
      </div>
    </motion.div>
  );
}
