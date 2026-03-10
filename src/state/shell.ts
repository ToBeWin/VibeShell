import { useEffect, useState } from 'react';
import { HostKeyScanResult } from '../lib/domain';
import { LocalServer } from '../components/WorkspaceSidebar';

export interface NoticeState {
  title: string;
  message: string;
}

export function useShellState() {
  const [zenMode, setZenMode] = useState(false);
  const [aiOpen, setAiOpen] = useState(() => localStorage.getItem('aiOpen') !== 'false');
  const [sftpOpen, setSftpOpen] = useState(() => localStorage.getItem('sftpOpen') === 'true');
  const [showAddServer, setShowAddServer] = useState(false);
  const [editingServer, setEditingServer] = useState<LocalServer | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [pendingHostKeyPrompt, setPendingHostKeyPrompt] = useState<{ host: string; port: number; result: HostKeyScanResult } | null>(null);
  const [noticeModal, setNoticeModal] = useState<NoticeState | null>(null);
  const [ollamaModel, setOllamaModel] = useState(() => localStorage.getItem('ollamaModel') || 'llama3');
  const [ollamaUrl] = useState(() => localStorage.getItem('ollamaUrl') || 'http://localhost:11434');
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);

  useEffect(() => {
    localStorage.setItem('aiOpen', String(aiOpen));
  }, [aiOpen]);

  useEffect(() => {
    localStorage.setItem('sftpOpen', String(sftpOpen));
  }, [sftpOpen]);

  useEffect(() => {
    localStorage.setItem('ollamaModel', ollamaModel);
  }, [ollamaModel]);

  return {
    zenMode,
    setZenMode,
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
    ollamaModel,
    setOllamaModel,
    ollamaUrl,
    ollamaModels,
    setOllamaModels,
  };
}
