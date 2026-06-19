import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { runAgent, type AgentSettings, type ToolEvent, type ChatAttachment } from './agent.js';
import { knowledgeBase } from './knowledge.js';
import { personaManager } from './personas.js';
import { skillsManager } from './skills-manager.js';

// ============================================================
// 配置
// ============================================================

const PORT = parseInt(process.env.PORT || '3847', 10);
const DATA_DIR = path.resolve(process.cwd(), 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

// 确保数据目录存在
for (const dir of [DATA_DIR, UPLOAD_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ============================================================
// 设置持久化 (Web 版独立管理)
// ============================================================

const settingsPath = path.join(DATA_DIR, 'agent-settings.json');

function loadSettings(): AgentSettings {
  try {
    return { maxContextMessages: 20, ...JSON.parse(fs.readFileSync(settingsPath, 'utf-8')) };
  } catch {
    return {
      provider: 'openai',
      apiKey: '',
      model: 'gpt-4o-mini',
      baseUrl: '',
      temperature: 0.7,
      maxContextMessages: 20,
    };
  }
}

function saveSettings(s: AgentSettings) {
  fs.writeFileSync(settingsPath, JSON.stringify(s, null, 2), 'utf-8');
}

let currentSettings = loadSettings();

// ============================================================
// Express 应用
// ============================================================

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const upload = multer({ dest: UPLOAD_DIR, limits: { fileSize: 50 * 1024 * 1024 } });

// --- Agent 对话 ---
app.post('/api/chat', async (req, res) => {
  const { message, attachments, chatHistory } = req.body as {
    message: string;
    attachments?: ChatAttachment[];
    chatHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  };
  try {
    const toolEvents: ToolEvent[] = [];
    const wsClients = getWsClients();

    const result = await runAgent(
      message,
      currentSettings,
      (event: ToolEvent) => {
        toolEvents.push(event);
        // 推送给所有 WS 客户端
        broadcast(wsClients, { type: 'tool-event', data: event });
      },
      attachments || [],
      chatHistory || [],
    );
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.json({ success: false, error: error.message || String(error) });
  }
});

// --- 设置 ---
app.get('/api/settings', (_req, res) => {
  res.json(currentSettings);
});

app.post('/api/settings', (req, res) => {
  currentSettings = { ...req.body, maxContextMessages: req.body.maxContextMessages || 20 };
  saveSettings(currentSettings);
  res.json({ success: true });
});

// --- 知识库 ---
app.get('/api/kb/documents', (_req, res) => {
  res.json(knowledgeBase.getDocuments());
});

app.post('/api/kb/upload', upload.array('files'), async (req, res) => {
  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) {
    res.json({ success: false, error: '未选择文件' });
    return;
  }

  const wsClients = getWsClients();
  const addedDocs: any[] = [];

  for (const file of files) {
    try {
      broadcast(wsClients, { type: 'kb-progress', data: { type: 'indexing', fileName: file.originalname } });
      const doc = await knowledgeBase.addDocument(file.path, currentSettings);
      addedDocs.push(doc);
      broadcast(wsClients, {
        type: 'kb-progress',
        data: { type: 'done', fileName: file.originalname, chunkCount: doc.chunkCount },
      });
    } catch (e: any) {
      broadcast(wsClients, {
        type: 'kb-progress',
        data: { type: 'error', fileName: file.originalname, error: e.message },
      });
      res.json({ success: false, error: `索引 ${file.originalname} 失败: ${e.message}` });
      return;
    }
  }
  res.json({ success: true, data: addedDocs });
});

app.delete('/api/kb/documents/:id', (req, res) => {
  const success = knowledgeBase.removeDocument(req.params.id);
  res.json({ success });
});

app.get('/api/kb/stats', (_req, res) => {
  res.json(knowledgeBase.getStats());
});

// --- 角色 ---
app.get('/api/personas', (_req, res) => {
  res.json(personaManager.getAll());
});

app.get('/api/personas/active', (_req, res) => {
  res.json(personaManager.getActive());
});

app.post('/api/personas/:id/activate', (req, res) => {
  const success = personaManager.setActive(req.params.id);
  res.json({ success });
});

app.post('/api/personas', (req, res) => {
  const persona = personaManager.addCustom(req.body);
  res.json(persona);
});

app.put('/api/personas/:id', (req, res) => {
  const success = personaManager.updatePersona(req.params.id, req.body);
  res.json({ success });
});

app.delete('/api/personas/:id', (req, res) => {
  const success = personaManager.removePersona(req.params.id);
  res.json({ success });
});

// --- 技能 ---
app.get('/api/skills', (_req, res) => {
  res.json(skillsManager.getAll());
});

app.post('/api/skills', (req, res) => {
  const skill = skillsManager.addSkill(req.body);
  res.json(skill);
});

app.put('/api/skills/:id', (req, res) => {
  const success = skillsManager.updateSkill(req.params.id, req.body);
  res.json({ success });
});

app.delete('/api/skills/:id', (req, res) => {
  const success = skillsManager.removeSkill(req.params.id);
  res.json({ success });
});

app.patch('/api/skills/:id/toggle', (req, res) => {
  const { enabled } = req.body;
  const success = skillsManager.toggleSkill(req.params.id, enabled);
  res.json({ success });
});

// --- 媒体 (Web 版使用浏览器原生文件选择器，不需要后端接口) ---

// ============================================================
// WebSocket 服务器
// ============================================================

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

function getWsClients(): Set<WebSocket> {
  const clients = new Set<WebSocket>();
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) clients.add(client);
  });
  return clients;
}

function broadcast(clients: Set<WebSocket>, message: any) {
  const data = JSON.stringify(message);
  clients.forEach((client) => client.send(data));
}

wss.on('connection', (ws) => {
  console.log('[WS] 客户端已连接');
  ws.on('close', () => console.log('[WS] 客户端已断开'));
});

// ============================================================
// 启动
// ============================================================

httpServer.listen(PORT, () => {
  console.log(`[QAQ Server] 服务已启动: http://localhost:${PORT}`);
  console.log(`[QAQ Server] WebSocket:    ws://localhost:${PORT}/ws`);
  console.log(`[QAQ Server] 数据目录:     ${DATA_DIR}`);
});
