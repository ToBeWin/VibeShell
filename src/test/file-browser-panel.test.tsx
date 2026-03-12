import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { FileBrowserPanel } from '../components/FileBrowserPanel';
import { AgentPanel } from '../components/AgentPanel';
import React from 'react';
import '../i18n';

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
  motion: {
    aside: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => React.createElement('aside', props, children),
    div: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => React.createElement('div', props, children),
  },
}));

vi.mock('../hooks/useSftpDragDrop', () => ({
  useSftpDragDrop: () => ({
    isDragging: false,
    uploadProgress: new Map(),
    handleDrop: vi.fn(),
    handleDragEnter: vi.fn(),
    handleDragLeave: vi.fn(),
    handleDragOver: vi.fn(),
    clearError: vi.fn(),
  }),
}));

describe('FileBrowserPanel', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders only the SFTP protocol button', () => {
    const html = renderToStaticMarkup(
      <FileBrowserPanel
        host="example.com"
        sessionId={null}
        files={[]}
        path="/"
        loading={false}
        error=""
        protocolLabel="sftp"
        protocol="sftp"
        openFilePath={null}
        openFileContent=""
        fileDirty={false}
        fileSaving={false}
        transferRunning={false}
        onProtocolChange={() => {}}
        onFileContentChange={() => {}}
        onSaveFile={() => {}}
        onUploadFile={() => {}}
        onDownloadFile={() => {}}
        onCreateDirectory={() => {}}
        onRenameEntry={() => {}}
        onDeleteEntry={() => {}}
        onClose={() => {}}
        onInit={() => {}}
        onNavigate={() => {}}
      />
    );

    expect(html).toContain('>sftp<');
    expect(html).not.toContain('>ftp<');
    expect(html).toContain('browse remote files in this drawer over SFTP.');
  });

  it('keeps the editor writable for SFTP when a file is open', () => {
    const html = renderToStaticMarkup(
      <FileBrowserPanel
        host="example.com"
        sessionId="sftp-pane-1"
        files={['README.md']}
        path="/"
        loading={false}
        error=""
        protocolLabel="sftp"
        protocol="sftp"
        openFilePath="/README.md"
        openFileContent="hello"
        fileDirty={false}
        fileSaving={false}
        transferRunning={false}
        onProtocolChange={() => {}}
        onFileContentChange={() => {}}
        onSaveFile={() => {}}
        onUploadFile={() => {}}
        onDownloadFile={() => {}}
        onCreateDirectory={() => {}}
        onRenameEntry={() => {}}
        onDeleteEntry={() => {}}
        onClose={() => {}}
        onInit={() => {}}
        onNavigate={() => {}}
      />
    );

    expect(html).toContain('/README.md');
    expect(html).not.toContain('readonly=""');
  });

  it('keeps the editor read-only while loading', () => {
    const html = renderToStaticMarkup(
      <FileBrowserPanel
        host="example.com"
        sessionId="sftp-pane-1"
        files={['README.md']}
        path="/"
        loading={true}
        error=""
        protocolLabel="sftp"
        protocol="sftp"
        openFilePath="/README.md"
        openFileContent="hello"
        fileDirty={false}
        fileSaving={false}
        transferRunning={false}
        onProtocolChange={() => {}}
        onFileContentChange={() => {}}
        onSaveFile={() => {}}
        onUploadFile={() => {}}
        onDownloadFile={() => {}}
        onCreateDirectory={() => {}}
        onRenameEntry={() => {}}
        onDeleteEntry={() => {}}
        onClose={() => {}}
        onInit={() => {}}
        onNavigate={() => {}}
      />
    );

    expect(html).toContain('readonly=""');
  });

  it('renders compact agent state as waiting for terminal context', () => {
    const html = renderToStaticMarkup(
      <AgentPanel
        ragContext={[]}
        sessionContext={{
          sessionId: undefined,
          host: '',
          user: '',
          cwd: '',
          recentOutput: [],
          recentCommands: [],
        }}
        online={true}
        hasContext={false}
        compact={true}
        action="analyze_error"
        prompt="Check this later"
        running={false}
        response={null}
        error=""
        onActionChange={() => {}}
        onPromptChange={() => {}}
        onRun={() => {}}
      />
    );

    expect(html).toContain('Model online · waiting for terminal context');
    expect(html).toContain('Connect a terminal or remote files session to unlock pane-aware actions');
    expect(html).toContain('Context required');
    expect(html).not.toContain('pane context ready');
  });

  it('renders a minimal compact ai drawer without agent actions', async () => {
    const { AiDrawer } = await import('../components/AiDrawer');
    const html = renderToStaticMarkup(
      <AiDrawer
        open={true}
        width={360}
        title="Vibe AI"
        models={['qwen3.5:2b']}
        selectedModel="qwen3.5:2b"
        onSelectModel={() => {}}
        onClose={() => {}}
        onWidthChange={() => {}}
        chatHistory={[]}
        isThinking={false}
        chatInput=""
        onChatInputChange={() => {}}
        onSendMessage={() => {}}
        ragContext={[]}
        contextConnectedLabel="Context attached"
        contextEmptyLabel="No context"
        thinkingLabel="Thinking"
        inputPlaceholder="Ask Ollama..."
        sessionContext={{
          sessionId: undefined,
          host: '',
          user: '',
          cwd: '',
          recentOutput: [],
          recentCommands: [],
        }}
        agentAction="analyze_error"
        agentPrompt=""
        agentRunning={false}
        agentResponse={null}
        agentError=""
        aiProvider="ollama"
        aiModel="qwen3.5:2b"
        aiBaseUrl=""
        onAgentActionChange={() => {}}
        onAgentPromptChange={() => {}}
        onRunAgent={() => {}}
      />
    );

    expect(html).toContain('Assistant ready');
    expect(html).toContain('Quick Prompt');
    expect(html).not.toContain('Agent Actions');
    expect(html).not.toContain('No terminal context yet');
  });
});
