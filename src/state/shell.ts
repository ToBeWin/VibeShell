import { useEffect, useState } from 'react';
import { HostKeyScanResult } from '../lib/domain';
import { LocalServer } from '../components/WorkspaceSidebar';

export interface NoticeState {
  title: string;
  message: string;
}

export interface DialogRequestState {
  title: string;
  message: string;
  kind: 'input' | 'confirm';
  inputType?: 'text' | 'password';
  confirmLabel?: string;
  cancelLabel?: string;
  defaultValue?: string;
}

export type AppTheme = 'dark' | 'midnight' | 'ocean';
export type TerminalFont = 'JetBrains Mono' | 'Cascadia Code' | 'Fira Code' | 'SF Mono' | 'Menlo';
const DEFAULT_AI_DRAWER_WIDTH = 360;
const MIN_AI_DRAWER_WIDTH = 320;
const MAX_AI_DRAWER_WIDTH = 720;

export function useShellState() {
  const [zenMode, setZenMode] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === 'true');
  const [aiOpen, setAiOpen] = useState(() => localStorage.getItem('aiOpen') !== 'false');
  const [sftpOpen, setSftpOpen] = useState(() => localStorage.getItem('sftpOpen') === 'true');
  const [showAddServer, setShowAddServer] = useState(false);
  const [editingServer, setEditingServer] = useState<LocalServer | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [pendingHostKeyPrompt, setPendingHostKeyPrompt] = useState<{ host: string; port: number; result: HostKeyScanResult } | null>(null);
  const [noticeModal, setNoticeModal] = useState<NoticeState | null>(null);
  const [dialogRequest, setDialogRequest] = useState<DialogRequestState | null>(null);
  const [ollamaModel, setOllamaModel] = useState(() => localStorage.getItem('ollamaModel') || 'llama3');
  const [ollamaUrl] = useState(() => localStorage.getItem('ollamaUrl') || 'http://localhost:11434');
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [theme, setTheme] = useState<AppTheme>(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'midnight' || saved === 'ocean' ? saved : 'dark';
  });
  const [terminalFont, setTerminalFont] = useState<TerminalFont>(() => {
    const saved = localStorage.getItem('terminalFont');
    return saved === 'Cascadia Code' || saved === 'Fira Code' || saved === 'SF Mono' || saved === 'Menlo'
      ? saved
      : 'JetBrains Mono';
  });
  const [aiDrawerWidth, setAiDrawerWidth] = useState(() => {
    const saved = Number(localStorage.getItem('aiDrawerWidth') || DEFAULT_AI_DRAWER_WIDTH);
    if (Number.isNaN(saved)) {
      return DEFAULT_AI_DRAWER_WIDTH;
    }
    return Math.min(MAX_AI_DRAWER_WIDTH, Math.max(MIN_AI_DRAWER_WIDTH, saved));
  });

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    localStorage.setItem('aiOpen', String(aiOpen));
  }, [aiOpen]);

  useEffect(() => {
    if (zenMode) {
      setSidebarCollapsed(true);
    }
  }, [zenMode]);

  useEffect(() => {
    localStorage.setItem('sftpOpen', String(sftpOpen));
  }, [sftpOpen]);

  useEffect(() => {
    localStorage.setItem('ollamaModel', ollamaModel);
  }, [ollamaModel]);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('terminalFont', terminalFont);
    document.documentElement.style.setProperty('--terminal-font-family', `"${terminalFont}", monospace`);
  }, [terminalFont]);

  useEffect(() => {
    localStorage.setItem('aiDrawerWidth', String(aiDrawerWidth));
  }, [aiDrawerWidth]);

  return {
    zenMode,
    setZenMode,
    sidebarCollapsed,
    setSidebarCollapsed,
    aiOpen,
    setAiOpen,
    sftpOpen,
    setSftpOpen,
    showAddServer,
    setShowAddServer,
    editingServer,
    setEditingServer,
    showSettings,
    setShowSettings,
    pendingHostKeyPrompt,
    setPendingHostKeyPrompt,
    noticeModal,
    setNoticeModal,
    dialogRequest,
    setDialogRequest,
    ollamaModel,
    setOllamaModel,
    ollamaUrl,
    ollamaModels,
    setOllamaModels,
    theme,
    setTheme,
    terminalFont,
    setTerminalFont,
    aiDrawerWidth,
    setAiDrawerWidth,
  };
}
