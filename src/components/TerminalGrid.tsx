// Multi-pane Zellij-style terminal layout
import { motion, AnimatePresence } from 'framer-motion';
import { X, Wifi, SplitSquareHorizontal, SplitSquareVertical } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';
import { useTranslation } from 'react-i18next';
import { useTerminalGridState } from '../state/terminal-grid';
import { useTerminalPaneRuntime } from '../state/terminal-runtime';

export interface PaneConfig {
  id: string;
  serverId?: string;
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
  terminalFont,
  onActivate,
  onClose,
  onConnect,
  onLine,
  canClose,
}: {
  pane: PaneConfig;
  active: boolean;
  terminalFont: string;
  onActivate: () => void;
  onClose: () => void;
  onConnect?: () => void;
  onLine?: (line: string) => void;
  canClose: boolean;
}) {
  const { t } = useTranslation();
  const { containerRef, inputRef, focusTerminal } = useTerminalPaneRuntime({ pane, active, onLine, terminalFont });

  return (
    <div
      tabIndex={0}
      onClick={() => {
        onActivate();
        focusTerminal();
      }}
      className={`relative flex min-h-0 flex-1 cursor-default flex-col overflow-hidden rounded-[24px] border transition-all duration-200 ${
        active
          ? 'border-cyan-300/15 shadow-[0_18px_46px_rgba(0,0,0,0.42)]'
          : 'border-white/[0.06] shadow-[0_12px_30px_rgba(0,0,0,0.26)]'
      } bg-[linear-gradient(180deg,rgba(7,11,18,0.96),rgba(5,7,12,0.98))]`}
    >
      <div className={`flex shrink-0 items-center gap-2.5 border-b px-4 py-2.5 transition-colors ${
        active ? 'border-cyan-300/12 bg-cyan-400/[0.04]' : 'border-white/[0.05] bg-white/[0.015]'
      }`}>
        <div className="flex gap-1.5">
          {['#FF5F57','#FEBC2E','#28C840'].map(c => (
            <div key={c} className="w-3 h-3 rounded-full" style={{ background: c, boxShadow: `0 0 5px ${c}55` }}/>
          ))}
        </div>
        <div className="ml-2 flex min-w-0 items-center gap-2 text-xs">
          <Wifi size={11} className={pane.connected ? 'text-emerald-400' : pane.connecting ? 'text-amber-300' : 'text-gray-600'} />
          <span className="truncate font-mono text-gray-300">{pane.label}</span>
          <span className="truncate font-mono text-[10px] text-gray-600">{pane.host}</span>
        </div>
        {!pane.connected && onConnect && (
          <button
            onClick={e => { e.stopPropagation(); onConnect(); }}
            disabled={pane.connecting}
            className="ml-auto rounded-xl border border-cyan-300/15 bg-cyan-400/[0.08] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100 transition-colors hover:bg-cyan-400/[0.16] disabled:cursor-wait disabled:opacity-50"
          >
            {pane.connecting ? t('terminal.connecting') : t('terminal.connect')}
          </button>
        )}
        {canClose && (
          <button
            onClick={e => { e.stopPropagation(); onClose(); }}
            className={`${!pane.connected && onConnect ? '' : 'ml-auto '}flex h-6 w-6 items-center justify-center rounded-md text-gray-700 transition-colors hover:bg-white/10 hover:text-white`}
          >
            <X size={12}/>
          </button>
        )}
      </div>
      <div ref={containerRef} className="flex-1 p-2 pl-3 pb-3" />
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
  terminalFont?: string;
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
  terminalFont = 'JetBrains Mono',
  onActivePaneChange,
  onCreatePane,
  onRemovePane,
  onConnectPane,
  onLine,
}: TerminalGridProps) {
  const { t } = useTranslation();
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
    <div className="flex flex-1 flex-col gap-3 p-5 min-h-0" style={{ background: 'linear-gradient(180deg, color-mix(in srgb, var(--app-shell-bg) 92%, #090b11), color-mix(in srgb, var(--app-shell-bg) 98%, #06070b))' }}>
      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={() => addPane('horizontal')}
          className="flex items-center gap-1.5 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-2 text-xs text-gray-500 transition-all hover:border-white/[0.12] hover:bg-white/[0.06] hover:text-white"
        >
          <SplitSquareHorizontal size={13}/> {t('terminal.splitH')}
        </button>
        <button
          onClick={() => addPane('vertical')}
          className="flex items-center gap-1.5 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-2 text-xs text-gray-500 transition-all hover:border-white/[0.12] hover:bg-white/[0.06] hover:text-white"
        >
          <SplitSquareVertical size={13}/> {t('terminal.splitV')}
        </button>
        {panes.length > 1 && (
          <span className="ml-2 text-[11px] font-mono uppercase tracking-[0.24em] text-gray-600">{t('terminal.paneCount', { count: panes.length })}</span>
        )}
      </div>

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
                terminalFont={terminalFont}
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
