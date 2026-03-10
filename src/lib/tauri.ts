/**
 * Tauri invoke bridge — all backend calls go through here.
 * If running in browser (dev without Tauri), falls back to mocks.
 */
import { invoke as tauriInvoke, Channel } from '@tauri-apps/api/core';
import { AgentRequest, AgentResponse, HostKeyRecord, HostKeyScanResult, ProviderProfile } from './domain';

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri) {
    return tauriInvoke<T>(cmd, args);
  }
  // Browser-only mock for development
  console.warn(`[mock] invoke: ${cmd}`, args);
  throw new Error(`Not running in Tauri — command '${cmd}' unavailable in browser.`);
}

// ── Server Config ──────────────────────────────────────────────────
export interface ServerConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  user: string;
}

export const getServers = (): Promise<ServerConfig[]> =>
  invoke<ServerConfig[]>('get_servers').catch(() => []);

export const saveServer = (server: ServerConfig): Promise<void> =>
  invoke('save_server', { server });

export const deleteServer = (id: string): Promise<void> =>
  invoke('delete_server', { id });

export const saveServerPassword = (serverId: string, password: string): Promise<void> =>
  invoke('save_server_password', { serverId, password });

export const getServerPassword = (serverId: string): Promise<string> =>
  invoke<string>('get_server_password', { serverId });

export const sshScanHostKey = (host: string, port: number): Promise<HostKeyScanResult> =>
  invoke<HostKeyScanResult>('ssh_scan_host_key', { host, port });

export const sshTrustHostKey = (host: string, port: number, keyBase64: string): Promise<void> =>
  invoke('ssh_trust_host_key', { host, port, keyBase64 });

export const listKnownHostKeys = (): Promise<HostKeyRecord[]> =>
  invoke<HostKeyRecord[]>('list_known_host_keys');

export const removeKnownHostKey = (host: string, keyBase64: string): Promise<void> =>
  invoke('remove_known_host_key', { host, keyBase64 });

// ── AI ─────────────────────────────────────────────────────────────
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export const aiChat = (
  provider: 'ollama' | 'openai' | 'anthropic',
  model: string,
  ollamaUrl: string,
  messages: ChatMessage[]
): Promise<string> =>
  invoke<string>('ai_chat', { provider, model, ollamaUrl, messages });

export const aiChatWithConfig = (
  provider: 'ollama' | 'openai' | 'anthropic',
  model: string,
  ollamaUrl: string,
  apiKey: string | undefined,
  maxContextTokens: number | undefined,
  messages: ChatMessage[]
): Promise<string> =>
  invoke<string>('ai_chat_with_config', { provider, model, ollamaUrl, apiKey, maxContextTokens, messages });

export const aiChatStream = async (
  provider: 'ollama' | 'openai' | 'anthropic',
  model: string,
  ollamaUrl: string,
  messages: ChatMessage[],
  onChunk: (chunk: string) => void
): Promise<void> => {
  const on_chunk = new Channel<string>();
  on_chunk.onmessage = onChunk;
  await invoke('ai_chat_stream', { provider, model, ollamaUrl, messages, onChunk: on_chunk });
};

export const aiChatStreamWithConfig = async (
  provider: 'ollama' | 'openai' | 'anthropic',
  model: string,
  ollamaUrl: string,
  apiKey: string | undefined,
  maxContextTokens: number | undefined,
  messages: ChatMessage[],
  onChunk: (chunk: string) => void
): Promise<void> => {
  const on_chunk = new Channel<string>();
  on_chunk.onmessage = onChunk;
  await invoke('ai_chat_stream_with_config', { provider, model, ollamaUrl, apiKey, maxContextTokens, messages, onChunk: on_chunk });
};

export const listOllamaModels = (ollamaUrl: string): Promise<string[]> =>
  invoke<string[]>('list_ollama_models', { ollamaUrl });

export const listAiProviderProfiles = (): Promise<ProviderProfile[]> =>
  invoke<ProviderProfile[]>('list_ai_provider_profiles');

export const runAgentTask = (
  provider: 'ollama' | 'openai' | 'anthropic',
  model: string,
  ollamaUrl: string,
  request: AgentRequest
): Promise<AgentResponse> =>
  invoke<AgentResponse>('run_agent_task', { provider, model, ollamaUrl, request });

// ── FTP ────────────────────────────────────────────────────────────
export type RemoteFileProtocol = 'ftp' | 'sftp';

export const ftpConnect = (sessionId: string, host: string, port: number, user: string, password: string): Promise<void> =>
  invoke('ftp_connect', { sessionId, host, port, user, password });

export const ftpList = (sessionId: string, path?: string): Promise<string[]> =>
  invoke<string[]>('ftp_list', { sessionId, path });

export const ftpCd = (sessionId: string, path: string): Promise<void> =>
  invoke('ftp_cd', { sessionId, path });

export const ftpDisconnect = (sessionId: string): Promise<void> =>
  invoke('ftp_disconnect', { sessionId });

export const remoteFilesConnect = (
  protocol: RemoteFileProtocol,
  sessionId: string,
  host: string,
  port: number,
  user: string,
  password: string
): Promise<void> =>
  invoke('remote_files_connect', { protocol, sessionId, host, port, user, password });

export const remoteFilesList = (
  protocol: RemoteFileProtocol,
  sessionId: string,
  path?: string
): Promise<string[]> =>
  invoke<string[]>('remote_files_list', { protocol, sessionId, path });

export const remoteFilesCd = (
  protocol: RemoteFileProtocol,
  sessionId: string,
  path: string
): Promise<void> =>
  invoke('remote_files_cd', { protocol, sessionId, path });

export const remoteFilesDisconnect = (
  protocol: RemoteFileProtocol,
  sessionId: string
): Promise<void> =>
  invoke('remote_files_disconnect', { protocol, sessionId });

export const remoteFilesRead = (
  protocol: RemoteFileProtocol,
  sessionId: string,
  path: string
): Promise<string> =>
  invoke<string>('remote_files_read', { protocol, sessionId, path });

export const remoteFilesWrite = (
  protocol: RemoteFileProtocol,
  sessionId: string,
  path: string,
  content: string
): Promise<void> =>
  invoke('remote_files_write', { protocol, sessionId, path, content });

export const remoteFilesDownload = (
  protocol: RemoteFileProtocol,
  sessionId: string,
  path: string
): Promise<number[]> =>
  invoke<number[]>('remote_files_download', { protocol, sessionId, path });

export const remoteFilesUpload = (
  protocol: RemoteFileProtocol,
  sessionId: string,
  path: string,
  data: number[]
): Promise<void> =>
  invoke('remote_files_upload', { protocol, sessionId, path, data });

export const remoteFilesMkdir = (
  protocol: RemoteFileProtocol,
  sessionId: string,
  path: string
): Promise<void> =>
  invoke('remote_files_mkdir', { protocol, sessionId, path });

export const remoteFilesRename = (
  protocol: RemoteFileProtocol,
  sessionId: string,
  oldPath: string,
  newPath: string
): Promise<void> =>
  invoke('remote_files_rename', { protocol, sessionId, oldPath, newPath });

export const remoteFilesDelete = (
  protocol: RemoteFileProtocol,
  sessionId: string,
  path: string
): Promise<void> =>
  invoke('remote_files_delete', { protocol, sessionId, path });

// ── SSH ────────────────────────────────────────────────────────────
export const sshConnect = (sessionId: string, host: string, port: number, user: string, password: string): Promise<void> =>
  invoke('ssh_connect', { sessionId, host, port, user, password });

export const sshWrite = (sessionId: string, data: number[]): Promise<void> =>
  invoke('ssh_write', { sessionId, data });

export const sshResize = (sessionId: string, cols: number, rows: number): Promise<void> =>
  invoke('ssh_resize', { sessionId, cols, rows });

export const sshDisconnect = (sessionId: string): Promise<void> =>
  invoke('ssh_disconnect', { sessionId });

export const sshDrainOutput = (sessionId: string): Promise<number[][]> =>
  invoke<number[][]>('ssh_drain_output', { sessionId });

export const sshDrainStatus = (
  sessionId: string
): Promise<Array<{ session_id: string; level: string; message: string }>> =>
  invoke<Array<{ session_id: string; level: string; message: string }>>('ssh_drain_status', { sessionId });

export const sshTestConnection = (host: string, port: number, user: string): Promise<string> =>
  invoke<string>('ssh_test_connection', { host, port, user });
