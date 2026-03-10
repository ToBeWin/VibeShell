import { Terminal } from '@xterm/xterm';
import { PaneConfig } from '../components/TerminalGrid';
import { sshWrite } from '../lib/tauri';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';

type TerminalKeyboardEvent = Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey'>;

export type TerminalMode = 'remote' | 'disconnected';

export function getTerminalMode(pane: PaneConfig): TerminalMode {
  return pane.connected && !!pane.sessionId ? 'remote' : 'disconnected';
}

export function writePaneBanner(term: Terminal, pane: PaneConfig) {
  term.writeln(`\x1b[2m${'─'.repeat(50)}\x1b[0m`);
  if (getTerminalMode(pane) === 'remote') {
    term.writeln(`  \x1b[1;32m✓ Connected\x1b[0m  \x1b[2m${pane.user}@${pane.host}\x1b[0m`);
  } else {
    term.writeln(`  \x1b[1;33m○ Not connected\x1b[0m  \x1b[2mPress Connect to start SSH session\x1b[0m`);
  }
  term.writeln(`\x1b[2m${'─'.repeat(50)}\x1b[0m\r\n`);
}

export function writePrompt(term: Terminal, pane: Pick<PaneConfig, 'user' | 'host'>) {
  term.write(`\x1b[1;32m${pane.user}@${pane.host}\x1b[0m:\x1b[1;34m~\x1b[0m$ `);
}

export function keyboardEventToTerminalInput(
  event: ReactKeyboardEvent<HTMLElement> | TerminalKeyboardEvent
): string | null {
  if (event.metaKey) {
    return null;
  }

  if (event.ctrlKey && !event.altKey && event.key.length === 1) {
    const upper = event.key.toUpperCase();
    const code = upper.charCodeAt(0);
    if (code >= 64 && code <= 95) {
      return String.fromCharCode(code - 64);
    }
  }

  switch (event.key) {
    case 'Enter':
      return '\r';
    case 'Backspace':
      return '\x7f';
    case 'Tab':
      return '\t';
    case 'Escape':
      return '\x1b';
    case 'ArrowUp':
      return '\x1b[A';
    case 'ArrowDown':
      return '\x1b[B';
    case 'ArrowRight':
      return '\x1b[C';
    case 'ArrowLeft':
      return '\x1b[D';
    case 'Home':
      return '\x1b[H';
    case 'End':
      return '\x1b[F';
    case 'Delete':
      return '\x1b[3~';
    default:
      break;
  }

  if (!event.ctrlKey && !event.altKey && event.key.length === 1) {
    return event.key;
  }

  return null;
}

export async function writeRemoteInput(term: Terminal, pane: PaneConfig, data: string) {
  if (getTerminalMode(pane) !== 'remote') {
    return false;
  }

  try {
    const sessionId = pane.sessionId;
    if (!sessionId) {
      return false;
    }
    const normalized = data === '\n' ? '\r' : data;
    await sshWrite(sessionId, Array.from(new TextEncoder().encode(normalized)));
    return true;
  } catch (error) {
    term.write(`\r\n\x1b[31m[ssh write failed]\x1b[0m ${String(error)}\r\n`);
    return true;
  }
}

export function handleDisconnectedTerminalInput(
  term: Terminal,
  data: string,
  hasShownHint: boolean
) {
  if (hasShownHint) {
    return true;
  }

  if (data === '\r' || data === '\x7f' || (data >= ' ' && data <= '~')) {
    term.write(`\r\n\x1b[33m[terminal offline]\x1b[0m Connect this pane before running commands.\r\n`);
    return true;
  }

  return hasShownHint;
}

export function handleLocalTerminalInput(
  term: Terminal,
  pane: Pick<PaneConfig, 'user' | 'host'>,
  data: string,
  lineBuffer: string,
  onLine?: (line: string) => void
) {
  if (data === '\r') {
    onLine?.(lineBuffer.trim());
    term.write('\r\n');
    writePrompt(term, pane);
    return '';
  }

  if (data === '\x7f') {
    if (lineBuffer.length > 0) {
      term.write('\b \b');
      return lineBuffer.slice(0, -1);
    }
    return lineBuffer;
  }

  term.write(data);
  return lineBuffer + data;
}

export function handleRemoteTerminalInput(
  term: Terminal,
  data: string,
  lineBuffer: string
) {
  if (data === '\n' || data === '\r') {
    term.write('\r\n');
    return '';
  }

  if (data === '\x7f') {
    if (lineBuffer.length > 0) {
      term.write('\b \b');
      return lineBuffer.slice(0, -1);
    }
    return lineBuffer;
  }

  if (data.length === 1 && data >= ' ' && data <= '~') {
    term.write(data);
    return lineBuffer + data;
  }

  return lineBuffer;
}
