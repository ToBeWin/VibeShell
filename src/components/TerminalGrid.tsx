// Multi-pane Zellij-style terminal layout
import { motion, AnimatePresence } from 'framer-motion';
import { X, Wifi, SplitSquareHorizontal, SplitSquareVertical } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';
import { useTerminalGridState } from '../state/terminal-grid';
import { useTerminalPaneRuntime } from '../state/terminal-runtime';

export interface PaneConfig {
  id: string;
  sessionKey?: string;
  sessionId?: string; // if undefined → local demo
  label: string;
  host: string;
  user: string;
  connected: boolean;
  connecting?: boolean;
}

// ─── Single Pane ──────────────────────────────────────────────────
function TerminalPane({
  pane,
  active,
  onActivate,
  onClose,
  onConnect,
  onLine,
  canClose,
}: {
  pane: PaneConfig;
  active: boolean;
  onActivate: () => void;
  onClose: () => void;
  onConnect?: () => void;
  onLine?: (line: string) => void;
  canClose: boolean;
}) {
  const { containerRef, inputRef, focusTerminal } = useTerminalPaneRuntime({ pane, active, onLine });

  return (
    <div
      tabIndex={0}
      onClick={() => {
        onActivate();
        focusTerminal();
      }}
      className={`relative flex-1 flex flex-col min-h-0 rounded-2xl overflow-hidden border transition-all duration-200 cursor-default ${
        active ? 'border-violet-500/30 shadow-[0_0_0_1px_rgba(139,92,246,0.15),0_8px_32px_rgba(0,0,0,0.4)]' : 'border-white/[0.06] shadow-lg'
      } bg-[#080810]/70 backdrop-blur-2xl`}
    >
      {/* Traffic-light bar */}
      <div className={`flex items-center gap-2.5 px-4 py-2 border-b transition-colors shrink-0 ${active ? 'border-violet-500/20 bg-violet-500/[0.04]' : 'border-white/[0.05] bg-white/[0.01]'}`}>
        <div className="flex gap-1.5">
          {['#FF5F57','#FEBC2E','#28C840'].map(c => (
            <div key={c} className="w-3 h-3 rounded-full" style={{ background: c, boxShadow: `0 0 5px ${c}55` }}/>
          ))}
        </div>
        <span className="text-xs font-mono text-gray-400 ml-2 flex items-center gap-1.5 opacity-70">
          <Wifi size={11} className={pane.connected ? 'text-green-400' : pane.connecting ? 'text-yellow-400' : 'text-gray-600'}/>
          {pane.label}
        </span>
        {!pane.connected && onConnect && (
          <button
            onClick={e => { e.stopPropagation(); onConnect(); }}
            disabled={pane.connecting}
            className="ml-auto rounded-md border border-violet-400/20 bg-violet-500/10 px-2 py-1 text-[10px] font-medium text-violet-200 transition-colors hover:bg-violet-500/20 disabled:cursor-wait disabled:opacity-50"
          >
            {pane.connecting ? 'Connecting...' : 'Connect'}
          </button>
        )}
        {canClose && (
          <button
            onClick={e => { e.stopPropagation(); onClose(); }}
            className={`${!pane.connected && onConnect ? '' : 'ml-auto '}w-5 h-5 flex items-center justify-center rounded-md text-gray-700 hover:text-white hover:bg-white/10 transition-colors`}
          >
            <X size={12}/>
          </button>
        )}
      </div>
      <div ref={containerRef} className="flex-1 p-1 pl-2 pb-2"/>
      <textarea
        ref={inputRef}
        aria-hidden="true"
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        className="absolute left-0 top-0 h-px w-px opacity-0 pointer-events-none"
      />
    </div>
  );
}

// ─── Terminal Grid (Zellij-style) ─────────────────────────────────
export type SplitDirection = 'horizontal' | 'vertical' | 'none';

interface TerminalGridProps {
  defaultPane: PaneConfig;
  availablePanes?: PaneConfig[];
  activePaneId?: string;
  onActivePaneChange?: (paneId: string) => void;
  onCreatePane?: (direction: SplitDirection) => void;
  onRemovePane?: (paneId: string) => void;
  onConnectPane?: (paneId: string) => void;
  onLine?: (line: string) => void;
}

export function TerminalGrid({
  defaultPane,
  availablePanes,
  activePaneId,
  onActivePaneChange,
  onCreatePane,
  onRemovePane,
  onConnectPane,
  onLine,
}: TerminalGridProps) {
  const { panes, split, activeId, addPane, removePane, activatePane } = useTerminalGridState({
    defaultPane,
    availablePanes,
    activePaneId,
    onActivePaneChange,
    onCreatePane,
    onRemovePane,
  });

  const containerClass = split === 'horizontal'
    ? 'flex flex-row gap-2'
    : split === 'vertical'
    ? 'flex flex-col gap-2'
    : 'flex flex-col';

  return (
    <div className="flex-1 flex flex-col min-h-0 p-4 gap-2">
      {/* Split controls */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => addPane('horizontal')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 hover:text-white bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] rounded-lg transition-all"
        >
          <SplitSquareHorizontal size={13}/> Split H
        </button>
        <button
          onClick={() => addPane('vertical')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 hover:text-white bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] rounded-lg transition-all"
        >
          <SplitSquareVertical size={13}/> Split V
        </button>
        {panes.length > 1 && (
          <span className="text-xs text-gray-700 font-mono ml-1">{panes.length} panes</span>
        )}
      </div>

      {/* Pane container */}
      <div className={`flex-1 min-h-0 ${containerClass}`}>
        <AnimatePresence mode="popLayout">
          {panes.map(p => (
            <motion.div
              key={p.id}
              layout
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.18 }}
              className="flex-1 flex min-h-0"
            >
              <TerminalPane
                pane={p}
                active={activeId === p.id}
                onActivate={() => activatePane(p.id)}
                onClose={() => removePane(p.id)}
                onConnect={onConnectPane ? () => onConnectPane(p.id) : undefined}
                onLine={onLine}
                canClose={panes.length > 1}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
