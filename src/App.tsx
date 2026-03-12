import { lazy, Suspense, useRef, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import '@xterm/xterm/css/xterm.css';
import { useTranslation } from 'react-i18next';
import {
  deleteServer,
  getServerPassword,
  remoteFilesDisconnect,
  sshDisconnect,
} from './lib/tauri';
import { TerminalGrid } from './components/TerminalGrid';
import { WorkspaceEmptyState } from './components/WorkspaceEmptyState';
import { WorkspaceSidebarV2 as WorkspaceSidebar, LocalServer } from './components/WorkspaceSidebarV2';
import { WorkspaceTabs } from './components/WorkspaceTabs';
import { ToastContainer } from './components/ToastContainer';
import { ConfirmModal, InputModal } from './components/DialogModals';
import { useToast } from './hooks/useToast';
import { restoreWorkspaceState, useWorkspacePersistence } from './hooks/useWorkspacePersistence';
import { usePaneAiState } from './state/ai';
import { useAiActions } from './state/ai-actions';
import { useAppShellBehaviors } from './state/app-shell-behaviors';
import { useAppBootstrap } from './state/bootstrap';
import { useConnectionActions } from './state/connection';
import { useRemoteFileActions } from './state/file-actions';
import { usePaneFileState } from './state/files';
import { useShellState } from './state/shell';
import { useSshSessionEvents } from './state/ssh-events';
import { shouldApplyRestoredWorkspace } from './state/workspace-restore';
import {
  collectPaneIdsForServer,
  collectPaneIdsForSession,
  useWorkspaceState,
} from './state/workspace';
import { useServerActions } from './state/server-actions';
import { useWorkspaceActions } from './state/workspace-actions';

const AiDrawer = lazy(() => import('./components/AiDrawer').then(module => ({ default: module.AiDrawer })));
const FileBrowserPanel = lazy(() => import('./components/FileBrowserPanel').then(module => ({ default: module.FileBrowserPanel })));
const SettingsPanel = lazy(() => import('./components/SettingsPanel').then(module => ({ default: module.SettingsPanel })));
const AddServerModal = lazy(() => import('./components/AppModals').then(module => ({ default: module.AddServerModal })));
const HostKeyTrustModal = lazy(() => import('./components/AppModals').then(module => ({ default: module.HostKeyTrustModal })));
const NoticeModal = lazy(() => import('./components/AppModals').then(module => ({ default: module.NoticeModal })));

// ─── Main App ──────────────────────────────────────────────────────
export default function App() {
  const { t, i18n }                        = useTranslation();
  const { toasts, dismissToast } = useToast();
  const initialServers: LocalServer[] = [
    { id: 'demo-1', name: 'prod-api-01', host: '10.0.1.1', port: 22, user: 'root', connected: false },
    { id: 'demo-2', name: 'dev-db',      host: '10.0.1.2', port: 22, user: 'admin', connected: false },
  ];
  const {
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
  } = useShellState();
  
  const {
    servers,
    setServers,
    sessions: workspaceSessions,
    setSessions: setWorkspaceSessions,
    panes: workspacePanes,
    setPanes: setWorkspacePanes,
    activeServer,
    setActiveServer,
    activeSessionId,
    setActiveSessionId,
    activePaneId,
    setActivePaneId,
    currentPane,
  } = useWorkspaceState(initialServers);
  
  const [inputText, setInputText]         = useState('');
  const [serversHydrated, setServersHydrated] = useState(false);
  const restoredWorkspaceRef = useRef(false);
  const hostKeyDecisionRef = useRef<((approved: boolean) => void) | null>(null);
  const inputDialogDecisionRef = useRef<((value: string | null) => void) | null>(null);
  const confirmDialogDecisionRef = useRef<((value: boolean) => void) | null>(null);

  const requestTextInput = (title: string, message: string, defaultValue = '', confirmLabel = t('modal.confirm')) =>
    new Promise<string | null>(resolve => {
      inputDialogDecisionRef.current = resolve;
      setDialogRequest({ kind: 'input', inputType: 'text', title, message, defaultValue, confirmLabel, cancelLabel: t('modal.cancel') });
    });

  const requestSecureInput = (title: string, message: string, defaultValue = '', confirmLabel = t('modal.confirm')) =>
    new Promise<string | null>(resolve => {
      inputDialogDecisionRef.current = resolve;
      setDialogRequest({ kind: 'input', inputType: 'password', title, message, defaultValue, confirmLabel, cancelLabel: t('modal.cancel') });
    });

  const requestConfirmation = (title: string, message: string, confirmLabel = t('modal.confirm')) =>
    new Promise<boolean>(resolve => {
      confirmDialogDecisionRef.current = resolve;
      setDialogRequest({ kind: 'confirm', title, message, confirmLabel, cancelLabel: t('modal.cancel') });
    });

  const resolveServerPassword = async (serverId: string, promptText: string): Promise<string | null> => {
    try {
      const stored = await getServerPassword(serverId);
      if (stored) {
        return stored;
      }
    } catch {}
    return requestSecureInput(t('modal.serverPasswordTitle'), promptText, '', t('modal.serverPasswordConfirm'));
  };

  const {
    paneFileSessionId,
    setPaneFileSessionId,
    setPaneFileList,
    setPaneFilePath,
    setPaneFileLoading,
    setPaneFileError,
    paneFileProtocol,
    setPaneFileProtocol,
    paneOpenFilePath,
    setPaneOpenFilePath,
    paneOpenFileContent,
    setPaneOpenFileContent,
    setPaneFileDirty,
    setPaneFileSaving,
    setPaneFileTransferRunning,
    currentFileSessionId,
    currentFileList,
    currentFilePath,
    currentFileLoading,
    currentFileError,
    currentFileProtocol,
    currentOpenFilePath,
    currentOpenFileContent,
    currentFileDirty,
    currentFileSaving,
    currentFileTransferRunning,
    removePaneState: removePaneFileState,
  } = usePaneFileState(activePaneId);

  const {
    setPaneChatHistory,
    setPaneThinkingState,
    setPaneAgentPrompt,
    setPaneAgentAction,
    setPaneAgentRunning,
    setPaneAgentResponse,
    setPaneAgentError,
    currentChatHistory,
    isThinking,
    currentAgentPrompt,
    currentAgentAction,
    currentAgentRunning,
    currentAgentResponse,
    currentAgentError,
    currentRagContext,
    currentCommandHistory,
    aiConfig,
    recordTerminalLine,
    removePaneState: removePaneAiState,
  } = usePaneAiState(activePaneId, t('ai.welcome'));

  useAppBootstrap({
    ollamaUrl,
    activePaneId,
    activeSessionId,
    workspaceSessions,
    workspacePanes,
    setServers,
    setWorkspaceSessions,
    setWorkspacePanes,
    setActiveServer,
    setActiveSessionId,
    setActivePaneId,
    setOllamaModels,
    setOllamaModel,
    onServersHydrated: () => setServersHydrated(true),
  });

  const handleRestoreWorkspace = useCallback((state: {
    sessions: Array<{ server_id: string; pane_ids: string[]; active_pane_id?: string }>;
    active_session_id?: string;
    last_saved: number;
  }) => {
      if (!serversHydrated || restoredWorkspaceRef.current) {
        return;
      }
      if (!shouldApplyRestoredWorkspace({
        servers,
        workspacePanes,
        activeSessionId,
        activePaneId,
      })) {
        restoredWorkspaceRef.current = true;
        return;
      }
      const restored = restoreWorkspaceState(state, servers);
      if (!restored) {
        restoredWorkspaceRef.current = true;
        return;
      }
      if (restoredWorkspaceRef.current) {
        return;
      }
      restoredWorkspaceRef.current = true;
      setWorkspaceSessions(restored.sessions);
      setWorkspacePanes(restored.panes);
      setActiveSessionId(restored.activeSessionId);
      setActivePaneId(restored.activePaneId);
      if (restored.activeServer) {
        setActiveServer(restored.activeServer);
      }
  }, [activePaneId, activeSessionId, serversHydrated, servers, setActivePaneId, setActiveServer, setActiveSessionId, setWorkspacePanes, setWorkspaceSessions, workspacePanes]);

  useWorkspacePersistence({
    availableServers: servers,
    workspaceSessions,
    workspacePanes,
    activeSessionId,
    activePaneId,
    enabled: serversHydrated,
    onRestore: handleRestoreWorkspace,
  });
  useSshSessionEvents({
    workspacePanes,
    setWorkspacePanes,
    setServers,
    setWorkspaceSessions,
    setActiveServer,
  });

  const { handleTerminalLine, handleKeyDown, currentPanePort, sessionContext } = useAppShellBehaviors({
    zenMode,
    setZenMode,
    activePaneId,
    activeServer,
    currentPane,
    workspaceSessions,
    currentCommandHistory,
    currentRagContext,
    currentFileSessionId,
    currentFilePath,
    currentOpenFilePath,
    recordTerminalLine,
  });
  const hasLiveConnection = workspacePanes.some(pane => pane.connected || pane.connecting);

  const { sendMessage, runAgentForActivePane } = useAiActions({
    activePaneId,
    ollamaModel,
    ollamaUrl,
    inputText,
    setInputText,
    currentChatHistory,
    currentRagContext,
    isThinking,
    currentAgentPrompt,
    currentAgentAction,
    currentAgentRunning,
    sessionContext,
    welcomeMessage: t('ai.welcome'),
    aiConfig,
    setPaneChatHistory,
    setPaneThinkingState,
    setPaneAgentRunning,
    setPaneAgentResponse,
    setPaneAgentError,
  });

  const {
    ensureTrustedHostKey,
    resolveHostKeyDecision,
    connectActiveServer,
    connectPaneById,
  } = useConnectionActions({
    activePaneId,
    activeServer,
    currentPane,
    currentPanePort,
    workspaceSessions,
    workspacePanes,
    setPendingHostKeyPrompt,
    hostKeyDecisionRef,
    setNoticeModal,
    resolveServerPassword,
    requestSecureInput,
    setServers,
    setWorkspaceSessions,
    setWorkspacePanes,
    setActiveServer,
  });

  const {
    initRemoteFiles,
    navRemoteFiles,
    closeFilePanel,
    setActivePaneFileProtocol,
    updateActivePaneFileContent,
    saveActivePaneFile,
    uploadFileToActivePane,
    downloadActivePaneFile,
    createDirectoryInActivePane,
    renameRemoteEntryInActivePane,
    deleteRemoteEntryInActivePane,
  } = useRemoteFileActions({
    activePaneId,
    activeServer,
    currentPane,
    currentPanePort,
    workspaceSessions,
    paneFileSessionId,
    paneOpenFilePath,
    paneOpenFileContent,
    ensureTrustedHostKey,
    resolveServerPassword,
    requestTextInput,
    requestSecureInput,
    requestConfirmation,
    setSftpOpen,
    setPaneFileSessionId,
    setPaneFileList,
    setPaneFilePath,
    setPaneFileLoading,
    setPaneFileError,
    setPaneFileProtocol,
    setPaneOpenFilePath,
    setPaneOpenFileContent,
    setPaneFileDirty,
    setPaneFileSaving,
    setPaneFileTransferRunning,
    currentFileProtocol,
    currentFilePath,
  });

  const {
    addWorkspaceSession,
    createPaneForActiveSession,
    removeWorkspacePane,
    selectWorkspaceSession,
    selectServerInWorkspace,
    handleActivePaneChange,
  } = useWorkspaceActions({
    activePaneId,
    activeServer,
    servers,
    workspaceSessions,
    workspacePanes,
    paneFileSessionId,
    paneFileProtocol,
    setShowAddServer,
    setActiveServer,
    setActiveSessionId,
    setActivePaneId,
    setWorkspaceSessions,
    setWorkspacePanes,
    removePaneAiState,
    removePaneFileState,
  });

  const { handleSavedServer } = useServerActions({
    activePaneId,
    servers,
    workspaceSessions,
    workspacePanes,
    ensureTrustedHostKey,
    requestSecureInput,
    setNoticeModal,
    setServers,
    setWorkspaceSessions,
    setWorkspacePanes,
    setActiveServer,
    setActiveSessionId,
    setActivePaneId,
  });

  // Keyboard shortcuts for session switching (Cmd+1-9)
  useEffect(() => {
    localStorage.setItem('language', i18n.language);
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key >= '1' && e.key <= '9') {
        const index = parseInt(e.key) - 1;
        if (index < workspaceSessions.length) {
          e.preventDefault();
          selectWorkspaceSession(workspaceSessions[index].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [workspaceSessions, selectWorkspaceSession]);

  const openAddServerModal = () => {
    setEditingServer(null);
    setShowAddServer(true);
  };

  const openEditServerModal = (server: LocalServer) => {
    setEditingServer(server);
    setShowAddServer(true);
  };

  const handleDeleteServer = async (server: LocalServer) => {
    if (servers.length <= 1) {
      setNoticeModal({
        title: t('server.cannotDeleteTitle'),
        message: t('server.cannotDeleteMessage'),
      });
      return;
    }

    const deleted = await deleteServer(server.id).then(() => true).catch(error => {
      setNoticeModal({
        title: t('server.deleteFailedTitle'),
        message: String(error),
      });
      return false;
    });
    if (!deleted) return;

    const removedPaneIds = new Set(collectPaneIdsForServer(workspacePanes, server.id));
    const panesToRemove = workspacePanes.filter(entry => removedPaneIds.has(entry.id));
    await Promise.allSettled(
      panesToRemove.flatMap(pane => {
        const tasks: Promise<unknown>[] = [];
        if (pane.sessionId) {
          tasks.push(sshDisconnect(pane.sessionId));
        }
        const fileSessionId = paneFileSessionId[pane.id];
        if (fileSessionId) {
          tasks.push(remoteFilesDisconnect(paneFileProtocol[pane.id] ?? 'sftp', fileSessionId));
        }
        return tasks;
      })
    );

    const nextServers = servers.filter(entry => entry.id !== server.id);
    const nextSessions = workspaceSessions.filter(entry => entry.id !== server.id);
    const nextPanes = workspacePanes.filter(entry => !removedPaneIds.has(entry.id));

    removedPaneIds.forEach(paneId => {
      removePaneAiState(paneId);
      removePaneFileState(paneId);
    });

    setServers(nextServers);
    setWorkspaceSessions(nextSessions);
    if (nextPanes.length > 0) {
      setWorkspacePanes(nextPanes);
    }

    if (activeServer.id === server.id || removedPaneIds.has(activePaneId)) {
      const fallbackServer = nextSessions[0] ?? nextServers[0];
      if (fallbackServer) {
        setActiveServer(fallbackServer);
        setActiveSessionId(fallbackServer.id);
        const fallbackPane = nextPanes.find(entry => entry.serverId === fallbackServer.id)
          ?? nextPanes.find(entry => entry.sessionKey?.startsWith(`session-${fallbackServer.id}`) || entry.id === `pane-${fallbackServer.id}`)
          ?? nextPanes[0];
        if (fallbackPane) {
          setActivePaneId(fallbackPane.id);
        }
      }
    }
  };

  const handleRemoveSession = async (sessionId: string) => {
    const session = workspaceSessions.find(entry => entry.id === sessionId);
    if (!session) {
      return;
    }

    const removedPaneIds = new Set(collectPaneIdsForSession(workspacePanes, sessionId));
    const panesToRemove = workspacePanes.filter(entry => removedPaneIds.has(entry.id));
    await Promise.allSettled(
      panesToRemove.flatMap(pane => {
        const tasks: Promise<unknown>[] = [];
        if (pane.sessionId) {
          tasks.push(sshDisconnect(pane.sessionId));
        }
        const fileSessionId = paneFileSessionId[pane.id];
        if (fileSessionId) {
          tasks.push(remoteFilesDisconnect(paneFileProtocol[pane.id] ?? 'sftp', fileSessionId));
        }
        return tasks;
      })
    );

    const nextSessions = workspaceSessions.filter(entry => entry.id !== sessionId);
    const nextPanes = workspacePanes.filter(entry => !removedPaneIds.has(entry.id));

    removedPaneIds.forEach(paneId => {
      removePaneAiState(paneId);
      removePaneFileState(paneId);
    });

    setWorkspaceSessions(nextSessions);
    setWorkspacePanes(nextPanes);

    if (nextSessions.length === 0) {
      setActiveSessionId('');
      setActivePaneId('');
      setActiveServer(servers.find(entry => entry.id !== sessionId) ?? servers[0]);
      return;
    }

    if (activeSessionId === sessionId || activeServer.id === sessionId || removedPaneIds.has(activePaneId)) {
      const fallbackSession = nextSessions[0];
      if (fallbackSession) {
        setActiveSessionId(fallbackSession.id);
        setActiveServer(fallbackSession);
        const fallbackPane = nextPanes.find(entry => entry.serverId === fallbackSession.id)
          ?? nextPanes.find(entry => entry.sessionKey?.startsWith(`session-${fallbackSession.id}`) || entry.id === `pane-${fallbackSession.id}`)
          ?? nextPanes[0];
        if (fallbackPane) {
          setActivePaneId(fallbackPane.id);
        }
      }
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden select-none text-gray-300"
      style={{ backgroundColor: 'var(--app-shell-bg)', backgroundImage: 'var(--app-shell-glow)' }}
      onKeyDown={handleKeyDown} tabIndex={-1}
    >
      {/* ── Sidebar ── */}
      <AnimatePresence>
        {!zenMode && (
          <WorkspaceSidebar
            servers={servers}
            activeServer={activeServer}
            aiOpen={aiOpen}
            sftpOpen={sftpOpen}
            aiOnline={ollamaModels.length > 0}
            collapsed={sidebarCollapsed}
            onSelectServer={selectServerInWorkspace}
            onAddServer={openAddServerModal}
            onEditServer={openEditServerModal}
            onDeleteServer={handleDeleteServer}
            onToggleAi={() => setAiOpen(v => !v)}
            onToggleSftp={() => setSftpOpen(v => !v)}
            onToggleZenMode={() => setZenMode(v => !v)}
            onToggleCollapse={() => setSidebarCollapsed(v => !v)}
            onOpenSettings={() => setShowSettings(true)}
          />
        )}
      </AnimatePresence>

      {/* ── Main: Tab bar + Terminal Grid ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {!zenMode && (
          <WorkspaceTabs
            sessions={workspaceSessions}
            activeSessionId={activeSessionId}
            onSelectSession={selectWorkspaceSession}
            onAddSession={addWorkspaceSession}
            onRemoveSession={handleRemoveSession}
          />
        )}

        {/* Zen exit hint */}
        <AnimatePresence>
          {zenMode && (
            <motion.button initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              onClick={() => setZenMode(false)}
              className="absolute top-4 right-4 z-20 text-xs text-gray-500 hover:text-white bg-[#16161F]/80 backdrop-blur border border-white/10 px-3 py-1.5 rounded-lg transition-all"
            >
              {t('terminal.exitZen')}
            </motion.button>
          )}
        </AnimatePresence>

        {hasLiveConnection ? (
          <TerminalGrid
            defaultPane={currentPane}
            availablePanes={workspacePanes}
            activePaneId={activePaneId}
            terminalFont={terminalFont}
            onActivePaneChange={handleActivePaneChange}
            onCreatePane={createPaneForActiveSession}
            onRemovePane={removeWorkspacePane}
            onConnectPane={connectPaneById}
            onLine={handleTerminalLine}
          />
        ) : (
          <WorkspaceEmptyState
            servers={servers}
            onConnectCurrent={connectActiveServer}
            onAddServer={openAddServerModal}
            onOpenFiles={() => setSftpOpen(true)}
            onSelectServer={selectServerInWorkspace}
          />
        )}
      </div>

      {/* ── SFTP Browser Panel ── */}
      <AnimatePresence>
        {!zenMode && sftpOpen && (
          <Suspense fallback={null}>
            <FileBrowserPanel
              host={activeServer.host}
              sessionId={currentFileSessionId}
              files={currentFileList}
              path={currentFilePath}
              loading={currentFileLoading}
              error={currentFileError}
              protocolLabel={currentFileProtocol}
              protocol={currentFileProtocol}
              openFilePath={currentOpenFilePath}
              openFileContent={currentOpenFileContent}
              fileDirty={currentFileDirty}
              fileSaving={currentFileSaving}
              transferRunning={currentFileTransferRunning}
              onProtocolChange={setActivePaneFileProtocol}
              onFileContentChange={updateActivePaneFileContent}
              onSaveFile={saveActivePaneFile}
              onUploadFile={uploadFileToActivePane}
              onDownloadFile={downloadActivePaneFile}
              onCreateDirectory={createDirectoryInActivePane}
              onRenameEntry={renameRemoteEntryInActivePane}
              onDeleteEntry={deleteRemoteEntryInActivePane}
              onClose={closeFilePanel}
              onInit={initRemoteFiles}
              onNavigate={navRemoteFiles}
            />
          </Suspense>
        )}
      </AnimatePresence>

      {!zenMode && (
        <Suspense fallback={null}>
          <AiDrawer
            open={aiOpen}
            width={aiDrawerWidth}
            title={t('ai.title')}
            models={ollamaModels}
            selectedModel={ollamaModel}
            onSelectModel={setOllamaModel}
            onClose={() => setAiOpen(false)}
            onWidthChange={setAiDrawerWidth}
            chatHistory={currentChatHistory}
            isThinking={isThinking}
            chatInput={inputText}
            onChatInputChange={setInputText}
            onSendMessage={sendMessage}
            ragContext={currentRagContext}
            contextConnectedLabel={t('ai.contextConnected')}
            contextEmptyLabel={t('ai.contextEmpty')}
            thinkingLabel={t('ai.thinking')}
            inputPlaceholder={t('ai.placeholder')}
            sessionContext={sessionContext}
            agentAction={currentAgentAction}
            agentPrompt={currentAgentPrompt}
            agentRunning={currentAgentRunning}
            agentResponse={currentAgentResponse}
            agentError={currentAgentError}
            aiProvider={aiConfig.provider}
            aiModel={aiConfig.model}
            aiBaseUrl={aiConfig.ollamaBaseUrl}
            onAgentActionChange={(action) => setPaneAgentAction(prev => ({ ...prev, [activePaneId]: action }))}
            onAgentPromptChange={(prompt) => setPaneAgentPrompt(prev => ({ ...prev, [activePaneId]: prompt }))}
            onRunAgent={runAgentForActivePane}
          />
        </Suspense>
      )}

      {/* ── Modals ── */}
      <AnimatePresence>
        {showAddServer && (
          <Suspense fallback={null}>
            <AddServerModal
              initialServer={editingServer}
              onClose={() => {
                setShowAddServer(false);
                setEditingServer(null);
              }}
              onSaved={handleSavedServer}
            />
          </Suspense>
        )}
        {pendingHostKeyPrompt && (
          <Suspense fallback={null}>
            <HostKeyTrustModal
              scan={pendingHostKeyPrompt}
              onApprove={() => resolveHostKeyDecision(true)}
              onReject={() => resolveHostKeyDecision(false)}
            />
          </Suspense>
        )}
        {noticeModal && (
          <Suspense fallback={null}>
            <NoticeModal
              title={noticeModal.title}
              message={noticeModal.message}
              onClose={() => setNoticeModal(null)}
            />
          </Suspense>
        )}
        {dialogRequest?.kind === 'input' && (
          <Suspense fallback={null}>
            <InputModal
              title={dialogRequest.title}
              message={dialogRequest.message}
              defaultValue={dialogRequest.defaultValue}
              inputType={dialogRequest.inputType}
              confirmLabel={dialogRequest.confirmLabel}
              cancelLabel={dialogRequest.cancelLabel}
              onConfirm={(value) => {
                setDialogRequest(null);
                inputDialogDecisionRef.current?.(value);
                inputDialogDecisionRef.current = null;
              }}
              onCancel={() => {
                setDialogRequest(null);
                inputDialogDecisionRef.current?.(null);
                inputDialogDecisionRef.current = null;
              }}
            />
          </Suspense>
        )}
        {dialogRequest?.kind === 'confirm' && (
          <Suspense fallback={null}>
            <ConfirmModal
              title={dialogRequest.title}
              message={dialogRequest.message}
              confirmLabel={dialogRequest.confirmLabel}
              cancelLabel={dialogRequest.cancelLabel}
              onConfirm={() => {
                setDialogRequest(null);
                confirmDialogDecisionRef.current?.(true);
                confirmDialogDecisionRef.current = null;
              }}
              onCancel={() => {
                setDialogRequest(null);
                confirmDialogDecisionRef.current?.(false);
                confirmDialogDecisionRef.current = null;
              }}
            />
          </Suspense>
        )}
        {showSettings && (
          <Suspense fallback={null}>
            <SettingsPanel
              theme={theme}
              onThemeChange={setTheme}
              terminalFont={terminalFont}
              onTerminalFontChange={setTerminalFont}
              onClose={() => setShowSettings(false)}
            />
          </Suspense>
        )}
      </AnimatePresence>
      
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
