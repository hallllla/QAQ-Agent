/**
 * Web API 通道 — 通过 HTTP fetch + WebSocket 与后端通信
 */
import type {
  QAQAPI,
  AgentSettings,
  ToolCallInfo,
  ToolEvent,
  KnowledgeDocument,
  KBStats,
  KBProgressEvent,
  AgentPersona,
  Skill,
} from '../types';

const BASE = '';

async function fetchJson<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, init);
  return res.json();
}

// ============================================================
// WebSocket 连接管理
// ============================================================

type WsListener = (msg: { type: string; data: any }) => void;
const wsListeners = new Set<WsListener>();
let ws: WebSocket | null = null;
let wsReconnectTimer: any = null;

function connectWs() {
  if (ws && ws.readyState <= WebSocket.OPEN) return;
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${location.host}/ws`);

  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      wsListeners.forEach((fn) => fn(msg));
    } catch { /* ignore */ }
  };

  ws.onclose = () => {
    ws = null;
    wsReconnectTimer = setTimeout(connectWs, 3000);
  };

  ws.onerror = () => { ws?.close(); };
}

function onWsMessage(listener: WsListener): () => void {
  wsListeners.add(listener);
  connectWs();
  return () => {
    wsListeners.delete(listener);
  };
}

// ============================================================
// 浏览器原生文件选择器辅助
// ============================================================

function pickFileFromBrowser(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => {
      const file = input.files?.[0] || null;
      resolve(file);
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

// ============================================================
// 创建 Web API 实现
// ============================================================

export function createWebApi(): QAQAPI {
  return {
    // --- Agent 对话 ---
    chat: async (message, attachments) => {
      return fetchJson('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, attachments }),
      });
    },

    chatWithHistory: async (message, attachments, history) => {
      return fetchJson('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, attachments, chatHistory: history }),
      });
    },

    onToolEvent: (callback: (event: ToolEvent) => void) => {
      return onWsMessage((msg) => {
        if (msg.type === 'tool-event') callback(msg.data);
      });
    },

    // --- 设置 ---
    getSettings: () => fetchJson<AgentSettings>('/api/settings'),

    saveSettings: async (settings: AgentSettings) => {
      const res = await fetchJson('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      return res.success;
    },

    // --- 知识库 ---
    kb: {
      getDocuments: () => fetchJson<KnowledgeDocument[]>('/api/kb/documents'),

      addDocument: async () => {
        const file = await pickFileFromBrowser('.txt,.md,.csv,.json,.log,.js,.ts,.py,.java,.go,.rs,.html,.css,.yaml,.yml,.xml');
        if (!file) return { success: false, error: '未选择文件' };

        const formData = new FormData();
        formData.append('files', file);

        const res = await fetch(`${BASE}/api/kb/upload`, {
          method: 'POST',
          body: formData,
        });
        return res.json();
      },

      removeDocument: async (docId: string) => {
        return fetchJson(`/api/kb/documents/${docId}`, { method: 'DELETE' });
      },

      getStats: () => fetchJson<KBStats>('/api/kb/stats'),

      onProgress: (callback: (event: KBProgressEvent) => void) => {
        return onWsMessage((msg) => {
          if (msg.type === 'kb-progress') callback(msg.data);
        });
      },
    },

    // --- 智能体角色 ---
    personas: {
      getAll: () => fetchJson<AgentPersona[]>('/api/personas'),

      getActive: () => fetchJson<AgentPersona>('/api/personas/active'),

      setActive: async (id: string) => {
        const res = await fetchJson(`/api/personas/${id}/activate`, { method: 'POST' });
        return res.success;
      },

      addCustom: async (persona) => {
        return fetchJson('/api/personas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(persona),
        });
      },

      removePersona: async (id: string) => {
        const res = await fetchJson(`/api/personas/${id}`, { method: 'DELETE' });
        return res.success;
      },

      updatePersona: async (id: string, updates) => {
        const res = await fetchJson(`/api/personas/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
        return res.success;
      },
    },

    // --- 技能管理 ---
    skills: {
      getAll: () => fetchJson<Skill[]>('/api/skills'),

      toggle: async (id: string, enabled: boolean) => {
        const res = await fetchJson(`/api/skills/${id}/toggle`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled }),
        });
        return res.success;
      },

      addSkill: async (skill) => {
        return fetchJson('/api/skills', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(skill),
        });
      },

      updateSkill: async (id: string, updates) => {
        const res = await fetchJson(`/api/skills/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
        return res.success;
      },

      removeSkill: async (id: string) => {
        const res = await fetchJson(`/api/skills/${id}`, { method: 'DELETE' });
        return res.success;
      },
    },

    // --- 图片/文件 (浏览器原生) ---
    media: {
      pickImage: async () => {
        const file = await pickFileFromBrowser('image/png,image/jpeg,image/gif,image/webp,image/bmp');
        if (!file) return null;
        const dataUrl = await fileToDataUrl(file);
        return { name: file.name, dataUrl, mimeType: file.type || 'image/png' };
      },

      pickFile: async () => {
        const file = await pickFileFromBrowser('.txt,.md,.csv,.json,.log,.js,.ts,.py,.java,.go,.rs,.html,.css,.yaml,.yml,.xml,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx');
        if (!file) return null;

        const textExts = ['.txt', '.md', '.csv', '.json', '.log', '.js', '.ts', '.py', '.java',
          '.go', '.rs', '.html', '.css', '.yaml', '.yml', '.xml'];
        const ext = '.' + file.name.split('.').pop()?.toLowerCase();

        if (textExts.includes(ext)) {
          const content = await readFileAsText(file);
          return { name: file.name, content, mimeType: 'text/plain', size: file.size };
        } else {
          return {
            name: file.name,
            content: `[文件: ${file.name}, 大小: ${(file.size / 1024).toFixed(1)}KB]`,
            mimeType: 'application/octet-stream',
            size: file.size,
          };
        }
      },
    },
  };
}
