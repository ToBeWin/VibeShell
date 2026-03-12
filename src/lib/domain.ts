export type ProviderRegion = 'local' | 'global' | 'cn';

export type ProviderKind =
  | 'ollama'
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'minimax'
  | 'glm'
  | 'deepseek'
  | 'qwen'
  | 'kimi';

export interface ProviderProfile {
  id: string;
  label: string;
  kind: ProviderKind;
  region: ProviderRegion;
  baseUrl: string;
  requiresApiKey: boolean;
  supportsChat: boolean;
  supportsStream: boolean;
  supportsEmbeddings: boolean;
  supportsTools: boolean;
}

export type AgentAction =
  | 'explain_command'
  | 'analyze_error'
  | 'analyze_logs'
  | 'generate_shell_script'
  | 'generate_python_script'
  | 'session_aware_chat';

export interface HostKeyRecord {
  host: string;
  algorithm: string;
  fingerprint: string;
  key_base64: string;
}

export interface HostKeyScanResult {
  trusted: boolean;
  fingerprint_changed: boolean;
  record: HostKeyRecord;
}

export interface SessionContext {
  sessionId?: string;
  paneId?: string;
  host?: string;
  user?: string;
  cwd?: string;
  filePath?: string;
  contextKind?: 'terminal' | 'files' | 'workspace';
  selectedText?: string;
  recentCommands: string[];
  recentOutput: string[];
}

export interface AgentRequest {
  action: AgentAction;
  userInput: string;
  context: SessionContext;
}

export interface AgentResponse {
  title: string;
  summary: string;
  suggestedCommand?: string | null;
  suggestedScript?: string | null;
  warnings: string[];
}
