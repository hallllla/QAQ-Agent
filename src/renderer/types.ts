// 声明 window.electronAPI 类型

export interface AgentSettings {
  provider: 'openai' | 'ollama';
  apiKey: string;
  model: string;
  baseUrl: string;
  temperature: number;
  /** 上下文窗口大小，保留最近 N 条对话 */
  maxContextMessages: number;
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

export interface ChatAttachment {
  id: string;
  type: 'image' | 'file';
  name: string;
  /** data URL or file path */
  dataUrl: string;
  mimeType?: string;
  size?: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCalls?: ToolCallInfo[];
  toolEvents?: ToolEvent[];
  attachments?: ChatAttachment[];
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

export interface AgentPersona {
  id: string;
  name: string;
  avatar: string;
  description: string;
  systemPrompt: string;
  isBuiltIn: boolean;
  createdAt: string;
}

export interface Skill {
  id: string;
  name: string;
  icon: string;
  description: string;
  prompt: string;
  parameters: SkillParameter[];
  enabled: boolean;
  isBuiltIn: boolean;
  createdAt: string;
}

export interface SkillParameter {
  name: string;
  type: 'string' | 'number' | 'boolean';
  description: string;
  required: boolean;
  default?: string | number | boolean;
}

export interface FileProcessingResult {
  name: string;
  content: string;
  mimeType: string;
  size: number;
}

export interface ElectronAPI {
  /** 发送文字 + 可选附件 (图片/文件) */
  chat: (
    message: string,
    attachments?: Array<{ name: string; dataUrl: string; mimeType?: string; type: 'image' | 'file' }>
  ) => Promise<{
    success: boolean;
    data?: { response: string; toolCalls: ToolCallInfo[] };
    error?: string;
  }>;
  chatWithHistory: (
    message: string,
    attachments?: Array<{ name: string; dataUrl: string; mimeType?: string; type: 'image' | 'file' }>,
    history?: Array<{ role: string; content: string }>
  ) => Promise<{
    success: boolean;
    data?: { response: string; toolCalls: ToolCallInfo[] };
    error?: string;
  }>;
  onToolEvent: (callback: (event: ToolEvent) => void) => () => void;

  // 设置
  getSettings: () => Promise<AgentSettings>;
  saveSettings: (settings: AgentSettings) => Promise<boolean>;

  // 知识库
  kb: {
    getDocuments: () => Promise<KnowledgeDocument[]>;
    addDocument: () => Promise<{ success: boolean; data?: KnowledgeDocument[]; error?: string }>;
    removeDocument: (docId: string) => Promise<{ success: boolean }>;
    getStats: () => Promise<KBStats>;
    onProgress: (callback: (event: KBProgressEvent) => void) => () => void;
  };

  // 智能体角色
  personas: {
    getAll: () => Promise<AgentPersona[]>;
    getActive: () => Promise<AgentPersona>;
    setActive: (id: string) => Promise<boolean>;
    addCustom: (persona: Omit<AgentPersona, 'id' | 'isBuiltIn' | 'createdAt'>) => Promise<AgentPersona>;
    removePersona: (id: string) => Promise<boolean>;
    updatePersona: (id: string, updates: Partial<AgentPersona>) => Promise<boolean>;
  };

  // 技能管理
  skills: {
    getAll: () => Promise<Skill[]>;
    toggle: (id: string, enabled: boolean) => Promise<boolean>;
    addSkill: (skill: Omit<Skill, 'id' | 'isBuiltIn' | 'createdAt'>) => Promise<Skill>;
    updateSkill: (id: string, updates: Partial<Skill>) => Promise<boolean>;
    removeSkill: (id: string) => Promise<boolean>;
  };

  // 图片/文件处理
  media: {
    pickImage: () => Promise<{ name: string; dataUrl: string; mimeType: string } | null>;
    pickFile: () => Promise<{ name: string; content: string; mimeType: string; size: number } | null>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
