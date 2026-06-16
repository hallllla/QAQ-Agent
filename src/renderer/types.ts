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

export interface ElectronAPI {
  chat: (message: string) => Promise<{
    success: boolean;
    data?: { response: string; toolCalls: ToolCallInfo[] };
    error?: string;
  }>;
  onToolEvent: (callback: (event: ToolEvent) => void) => () => void;
  getSettings: () => Promise<AgentSettings>;
  saveSettings: (settings: AgentSettings) => Promise<boolean>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
