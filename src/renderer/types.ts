// 声明 window.electronAPI 类型
export interface AgentSettings {
  provider: 'openai' | 'ollama';
  apiKey: string;
  model: string;
  baseUrl: string;
  temperature: number;
}

export interface ToolEvent {
  type: 'tool_start' | 'tool_end';
  toolName: string;
  input?: string;
  output?: string;
}

export interface ToolCallInfo {
  name: string;
  args: Record<string, any>;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCalls?: ToolCallInfo[];
  toolEvents?: ToolEvent[];
  timestamp: number;
  isLoading?: boolean;
  isError?: boolean;
}

export interface KnowledgeDocument {
  id: string;
  name: string;
  filePath: string;
  addedAt: string;
  chunkCount: number;
}

export interface KBStats {
  documentCount: number;
  chunkCount: number;
}

export interface KBProgressEvent {
  type: 'indexing' | 'done' | 'error';
  fileName: string;
  chunkCount?: number;
  error?: string;
}

export interface ElectronAPI {
  chat: (message: string) => Promise<{
    success: boolean;
    data?: { response: string; toolCalls: ToolCallInfo[] };
    error?: string;
  }>;
  onToolEvent: (callback: (event: ToolEvent) => void) => () => void;
  getSettings: () => Promise<AgentSettings>;
  saveSettings: (settings: AgentSettings) => Promise<boolean>;
  kb: {
    getDocuments: () => Promise<KnowledgeDocument[]>;
    addDocument: () => Promise<{
      success: boolean;
      data?: KnowledgeDocument[];
      error?: string;
    }>;
    removeDocument: (docId: string) => Promise<{ success: boolean }>;
    getStats: () => Promise<KBStats>;
    onProgress: (callback: (event: KBProgressEvent) => void) => () => void;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
