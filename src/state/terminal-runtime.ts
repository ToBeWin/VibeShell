import { useEffect, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { PaneConfig } from '../components/TerminalGrid';
import { sshResize } from '../lib/tauri';
import {
  getTerminalMode,
  handleDisconnectedTerminalInput,
  handleLocalTerminalInput,
  keyboardEventToTerminalInput,
  writePaneBanner,
  writeRemoteInput,
} from './terminal';
import { useCommandHistory } from '../hooks/useCommandHistory';

interface UseTerminalPaneRuntimeOptions {
  pane: PaneConfig;
  active: boolean;
  terminalFont?: string;
  onLine?: (line: string) => void;
}

function focusTerminalContainer(container: HTMLDivElement | null, term: Terminal | null) {
  term?.focus();
  const textarea = container?.querySelector('textarea');
  if (textarea instanceof HTMLTextAreaElement) {
    textarea.focus();
  }
}

export function useTerminalPaneRuntime({
  pane,
  active,
  terminalFont = 'JetBrains Mono',
  onLine,
}: UseTerminalPaneRuntimeOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const paneRef = useRef(pane);
  const activeRef = useRef(active);
  const onLineRef = useRef(onLine);
  const lineBufferRef = useRef('');
  const disconnectedHintShownRef = useRef(false);
  const previousModeRef = useRef<ReturnType<typeof getTerminalMode>>(getTerminalMode(pane));
  const currentInputRef = useRef('');
  
  // Command history integration
  const history = useCommandHistory(pane.serverId || null);
  const historyRef = useRef(history);
  const [, setIsNavigatingHistory] = useState(false);

  useEffect(() => {
    paneRef.current = pane;
  }, [pane]);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    onLineRef.current = onLine;
  }, [onLine]);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: `"${terminalFont}", monospace`,
      fontSize: 13.5,
      lineHeight: 1.5,
      theme: {
        background: 'transparent',
        foreground: '#E2E8F0',
        cursor: '#A78BFA',
        cursorAccent: '#0D0D11',
        selectionBackground: '#6D28D966',
        black: '#1E1E2E', brightBlack: '#45475A',
        red: '#F38BA8', brightRed: '#F38BA8',
        green: '#A6E3A1', brightGreen: '#A6E3A1',
        yellow: '#F9E2AF', brightYellow: '#F9E2AF',
        blue: '#89B4FA', brightBlue: '#89B4FA',
        magenta: '#CBA6F7', brightMagenta: '#CBA6F7',
        cyan: '#94E2D5', brightCyan: '#94E2D5',
        white: '#BAC2DE', brightWhite: '#CDD6F4',
      },
      scrollback: 50000,
      allowProposedApi: true,
      allowTransparency: true,
      scrollOnUserInput: true,
      smoothScrollDuration: 0,
    });

    const fit = new FitAddon();
    fitRef.current = fit;
    term.loadAddon(fit);
    term.open(container);
    termRef.current = term;
    writePaneBanner(term, pane);
    focusTerminalContainer(container, term);

    let fitFrame1 = 0;
    let fitFrame2 = 0;
    const safeFit = () => {
      if (!container.isConnected || !fitRef.current || !termRef.current) {
        return;
      }
      if (container.clientWidth <= 0 || container.clientHeight <= 0) {
        return;
      }
      try {
        fitRef.current.fit();
      } catch {}
    };

    const handleTerminalInput = async (data: string) => {
      const currentPane = paneRef.current;
      if (getTerminalMode(currentPane) === 'disconnected') {
        disconnectedHintShownRef.current = handleDisconnectedTerminalInput(
          term,
          data,
          disconnectedHintShownRef.current
        );
        return;
      }

      // For remote SSH connections, don't echo locally - let the server echo
      // Just send the input to the server
      const handledRemotely = await writeRemoteInput(term, currentPane, data);
      if (!handledRemotely) {
        // Only use local echo for non-SSH connections
        lineBufferRef.current = handleLocalTerminalInput(term, currentPane, data, lineBufferRef.current, onLineRef.current);
      }
    };

    const input = inputRef.current;

    const keydownListener = (event: KeyboardEvent) => {
      if (!activeRef.current) {
        return;
      }
      if (event.metaKey) {
        return;
      }

      const currentPane = paneRef.current;
      const isRemoteMode = getTerminalMode(currentPane) === 'remote';

      // Only handle command history in local mode, not in remote SSH mode
      // In remote mode, let the server handle history (bash history)
      if (!isRemoteMode) {
        // Handle command history navigation (up/down arrows) - LOCAL MODE ONLY
        if (event.key === 'ArrowUp' && !event.ctrlKey && !event.altKey) {
          event.preventDefault();
          event.stopPropagation();
          const historyCommand = historyRef.current.navigateUp(currentInputRef.current);
          if (historyCommand) {
            // Clear current line
            const clearLength = currentInputRef.current.length;
            for (let i = 0; i < clearLength; i++) {
              term.write('\b \b');
            }
            // Write history command
            term.write(historyCommand);
            currentInputRef.current = historyCommand;
            setIsNavigatingHistory(true);
          }
          return;
        }

        if (event.key === 'ArrowDown' && !event.ctrlKey && !event.altKey) {
          event.preventDefault();
          event.stopPropagation();
          const historyCommand = historyRef.current.navigateDown(currentInputRef.current);
          // Clear current line
          const clearLength = currentInputRef.current.length;
          for (let i = 0; i < clearLength; i++) {
            term.write('\b \b');
          }
          // Write history command or saved input
          term.write(historyCommand);
          currentInputRef.current = historyCommand;
          if (historyRef.current.currentIndex === -1) {
            setIsNavigatingHistory(false);
          }
          return;
        }

        // Handle Ctrl+R for reverse search - LOCAL MODE ONLY
        if (event.key === 'r' && event.ctrlKey && !event.altKey) {
          event.preventDefault();
          event.stopPropagation();
          historyRef.current.startSearch(currentInputRef.current);
          term.write('\r\n\x1b[2m(reverse-i-search): \x1b[0m');
          return;
        }
      }

      const data = keyboardEventToTerminalInput(event);
      if (!data) {
        return;
      }
      const isPrintableChar = !event.ctrlKey && !event.altKey && event.key.length === 1;
      if (isPrintableChar) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      
      // Handle Enter key - save command to history (LOCAL MODE ONLY)
      if (!isRemoteMode && data === '\r' && currentInputRef.current.trim()) {
        const command = currentInputRef.current.trim();
        historyRef.current.appendCommand(command);
        currentInputRef.current = '';
        setIsNavigatingHistory(false);
      }
      
      // Handle Backspace (LOCAL MODE ONLY)
      if (!isRemoteMode && data === '\x7f' && currentInputRef.current.length > 0) {
        currentInputRef.current = currentInputRef.current.slice(0, -1);
      }
      
      void handleTerminalInput(data);
    };

    const inputListener = (event: Event) => {
      if (!activeRef.current) {
        return;
      }
      const target = event.currentTarget;
      if (!(target instanceof HTMLTextAreaElement)) {
        return;
      }
      const text = target.value;
      target.value = '';
      if (!text) {
        return;
      }
      
      // Track current input for history navigation
      currentInputRef.current += text;
      
      void handleTerminalInput(text);
    };

    const pasteListener = (event: ClipboardEvent) => {
      if (!activeRef.current) {
        return;
      }
      const text = event.clipboardData?.getData('text');
      if (!text) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      void handleTerminalInput(text);
    };

    input?.addEventListener('keydown', keydownListener);
    input?.addEventListener('input', inputListener);
    input?.addEventListener('paste', pasteListener);

    // Ensure focus when clicking anywhere in the terminal container
    const containerClickListener = () => {
      focusTerminalContainer(container, term);
    };
    container.addEventListener('click', containerClickListener);

    // Auto-focus terminal when window regains focus (helps with zen mode)
    const windowFocusListener = () => {
      if (activeRef.current) {
        focusTerminalContainer(container, term);
      }
    };
    window.addEventListener('focus', windowFocusListener);

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        safeFit();
        const currentPane = paneRef.current;
        if (!currentPane.sessionId || !currentPane.connected) {
          return;
        }
        if (term.cols <= 0 || term.rows <= 0) {
          return;
        }
        sshResize(currentPane.sessionId, term.cols, term.rows).catch(error => {
          term.write(`\r\n\x1b[31m[ssh resize failed]\x1b[0m ${String(error)}\r\n`);
        });
      });
    });
    resizeObserver.observe(container);
    fitFrame1 = requestAnimationFrame(() => {
      fitFrame2 = requestAnimationFrame(() => safeFit());
    });
    queueMicrotask(() => focusTerminalContainer(container, term));
    setTimeout(() => focusTerminalContainer(container, term), 0);

    return () => {
      input?.removeEventListener('keydown', keydownListener);
      input?.removeEventListener('input', inputListener);
      input?.removeEventListener('paste', pasteListener);
      container.removeEventListener('click', containerClickListener);
      window.removeEventListener('focus', windowFocusListener);
      cancelAnimationFrame(fitFrame1);
      cancelAnimationFrame(fitFrame2);
      resizeObserver.disconnect();
      termRef.current = null;
      term.dispose();
      fitRef.current = null;
      };
  }, [pane.id, terminalFont]);

  useEffect(() => {
    const term = termRef.current;
    const sessionRef = pane.sessionId ?? pane.sessionKey;
    
    // CRITICAL FIX: Only set up listeners and polling when actually connected
    if (!term || !sessionRef || !pane.connected) {
      return;
    }

    let disposed = false;
    let unlistenOutput: (() => void) | null = null;
    let unlistenStatus: (() => void) | null = null;

    listen<{ session_id: string; data: number[] }>(`ssh-output-${sessionRef}`, event => {
      if (!disposed && event.payload.data) {
        term.write(new Uint8Array(event.payload.data));
        // Auto-scroll to bottom when receiving new output
        term.scrollToBottom();
      }
    }).then(fn => {
      if (disposed) {
        fn();
        return;
      }
      unlistenOutput = fn;
    }).catch(err => {
      console.error('Failed to register ssh-output listener:', err);
    });

    listen<{ session_id: string; level: string; message: string }>(`ssh-status-${sessionRef}`, event => {
      if (!disposed) {
        const color = event.payload.level === 'error'
          ? '\x1b[31m'
          : event.payload.level === 'debug'
          ? '\x1b[36m'
          : '\x1b[33m';
        term.write(`\r\n${color}[ssh]\x1b[0m ${event.payload.message}\r\n`);
      }
    }).then(fn => {
      if (disposed) {
        fn();
        return;
      }
      unlistenStatus = fn;
    }).catch(err => {
      console.error('Failed to register ssh-status listener:', err);
    });

    // NOTE: Polling is disabled to avoid dual-read data race
    // Events should be sufficient for receiving SSH output

    return () => {
      disposed = true;
      unlistenOutput?.();
      unlistenStatus?.();
    };
  }, [pane.sessionId, pane.sessionKey, pane.connected]);

  // REMOVED: Polling mechanism that caused dual read data race
  // The event listener above (ssh-output and ssh-status) is sufficient
  // Polling was causing data loss by competing with event listener for same buffer

  useEffect(() => {
    const term = termRef.current;
    if (!term) {
      return;
    }
    const nextMode = getTerminalMode(pane);
    const previousMode = previousModeRef.current;
    disconnectedHintShownRef.current = false;
    lineBufferRef.current = '';
    if (previousMode !== nextMode && nextMode === 'remote') {
      term.write(`\x1b[2m[session]\x1b[0m remote shell attached\r\n`);
      // Focus terminal after successful connection
      if (active) {
        setTimeout(() => {
          focusTerminalContainer(containerRef.current, termRef.current);
        }, 100);
      }
    }
    if (previousMode !== nextMode && nextMode === 'disconnected') {
      term.write(`\r\n\x1b[33m[session]\x1b[0m disconnected\r\n`);
    }
    previousModeRef.current = nextMode;
  }, [pane.connected, pane.sessionId, pane.host, pane.user, active]);

  useEffect(() => {
    if (active) {
      focusTerminalContainer(containerRef.current, termRef.current);
    }
  }, [active]);

  return {
    containerRef,
    inputRef,
    termRef,
    focusTerminal: () => {
      focusTerminalContainer(containerRef.current, termRef.current);
      inputRef.current?.focus();
    },
  };
}
