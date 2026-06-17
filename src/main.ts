import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { runAgent, type AgentSettings, type ToolEvent, type ChatAttachment } from './agent.js';
import { knowledgeBase } from './knowledge.js';
import { personaManager } from './personas.js';
import { skillsManager } from './skills-manager.js';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

let mainWindow: BrowserWindow | null = null;

// --- 设置持久化 ---
const settingsPath = path.join(app.getPath('userData'), 'agent-settings.json');

function loadSettings(): AgentSettings {
  try {
    const data = fs.readFileSync(settingsPath, 'utf-8');
    return { maxContextMessages: 20, ...JSON.parse(data) };
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

function saveSettings(settings: AgentSettings): void {
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
}

let currentSettings = loadSettings();

// --- 窗口创建 ---
const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 800,
    minHeight: 600,
    title: 'QAQ',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

// --- Agent IPC ---
ipcMain.handle('agent:chat', async (_event, message: string, attachments?: ChatAttachment[]) => {
  try {
    // 从前端传来的 chatHistory 由前端管理，此处简化为仅发当前消息
    const results = await runAgent(
      message,
      currentSettings,
      (event: ToolEvent) => {
        mainWindow?.webContents.send('agent:tool-event', event);
      },
      attachments || [],
    );
    return { success: true, data: results };
  } catch (error: any) {
    return { success: false, error: error.message || String(error) };
  }
});

// 带历史的对话
ipcMain.handle('agent:chat-history', async (_event,
  message: string,
  attachments?: ChatAttachment[],
  chatHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
) => {
  try {
    const results = await runAgent(
      message,
      currentSettings,
      (event: ToolEvent) => {
        mainWindow?.webContents.send('agent:tool-event', event);
      },
      attachments || [],
      chatHistory || [],
    );
    return { success: true, data: results };
  } catch (error: any) {
    return { success: false, error: error.message || String(error) };
  }
});

// --- 设置 IPC ---
ipcMain.handle('settings:get', () => currentSettings);
ipcMain.handle('settings:save', (_event, settings: AgentSettings) => {
  currentSettings = settings;
  saveSettings(settings);
  return true;
});

// --- 知识库 IPC ---
ipcMain.handle('kb:get-documents', () => knowledgeBase.getDocuments());

ipcMain.handle('kb:add-document', async () => {
  if (!mainWindow) return { success: false, error: '窗口未就绪' };
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择要添加到知识库的文件',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: '文本文件', extensions: ['txt', 'md', 'csv', 'json', 'log'] },
      { name: '代码文件', extensions: ['js', 'ts', 'py', 'java', 'go', 'rs', 'html', 'css', 'yaml', 'yml', 'xml'] },
      { name: '所有文件', extensions: ['*'] },
    ],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { success: false, error: '未选择文件' };
  }

  const addedDocs: any[] = [];
  for (const filePath of result.filePaths) {
    try {
      mainWindow.webContents.send('kb:progress', { type: 'indexing', fileName: path.basename(filePath) });
      const doc = await knowledgeBase.addDocument(filePath, currentSettings);
      addedDocs.push(doc);
      mainWindow.webContents.send('kb:progress', { type: 'done', fileName: path.basename(filePath), chunkCount: doc.chunkCount });
    } catch (e: any) {
      mainWindow.webContents.send('kb:progress', { type: 'error', fileName: path.basename(filePath), error: e.message });
      return { success: false, error: `索引 ${path.basename(filePath)} 失败: ${e.message}` };
    }
  }
  return { success: true, data: addedDocs };
});

ipcMain.handle('kb:remove-document', (_event, docId: string) => {
  return { success: knowledgeBase.removeDocument(docId) };
});

ipcMain.handle('kb:get-stats', () => knowledgeBase.getStats());

// --- 角色 IPC ---
ipcMain.handle('persona:get-all', () => personaManager.getAll());
ipcMain.handle('persona:get-active', () => personaManager.getActive());
ipcMain.handle('persona:set-active', (_event, id: string) => personaManager.setActive(id));
ipcMain.handle('persona:add-custom', (_event, persona: any) => personaManager.addCustom(persona));
ipcMain.handle('persona:remove', (_event, id: string) => personaManager.removePersona(id));
ipcMain.handle('persona:update', (_event, id: string, updates: any) => personaManager.updatePersona(id, updates));

// --- 技能 IPC ---
ipcMain.handle('skill:get-all', () => skillsManager.getAll());
ipcMain.handle('skill:toggle', (_event, id: string, enabled: boolean) => skillsManager.toggleSkill(id, enabled));
ipcMain.handle('skill:add', (_event, skill: any) => skillsManager.addSkill(skill));
ipcMain.handle('skill:update', (_event, id: string, updates: any) => skillsManager.updateSkill(id, updates));
ipcMain.handle('skill:remove', (_event, id: string) => skillsManager.removeSkill(id));

// --- 图片/文件选择 IPC ---
ipcMain.handle('media:pick-image', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择图片',
    properties: ['openFile'],
    filters: [
      { name: '图片文件', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] },
    ],
  });
  if (result.canceled || result.filePaths.length === 0) return null;

  const filePath = result.filePaths[0];
  const ext = path.extname(filePath).toLowerCase().replace('.', '');
  const mimeMap: Record<string, string> = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp',
  };
  const mimeType = mimeMap[ext] || 'image/png';
  const buffer = fs.readFileSync(filePath);
  const dataUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;
  return { name: path.basename(filePath), dataUrl, mimeType };
});

ipcMain.handle('media:pick-file', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择文件',
    properties: ['openFile'],
    filters: [
      { name: '文本文件', extensions: ['txt', 'md', 'csv', 'json', 'log'] },
      { name: '代码文件', extensions: ['js', 'ts', 'py', 'java', 'go', 'rs', 'html', 'css', 'yaml', 'yml', 'xml'] },
      { name: '文档', extensions: ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'] },
    ],
  });
  if (result.canceled || result.filePaths.length === 0) return null;

  const filePath = result.filePaths[0];
  const ext = path.extname(filePath).toLowerCase();
  const textExts = ['.txt', '.md', '.csv', '.json', '.log', '.js', '.ts', '.py', '.java',
    '.go', '.rs', '.html', '.css', '.yaml', '.yml', '.xml'];

  if (textExts.includes(ext)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const stat = fs.statSync(filePath);
    return {
      name: path.basename(filePath),
      content,
      mimeType: 'text/plain',
      size: stat.size,
    };
  } else {
    // 非文本文件，读取为 base64
    const buffer = fs.readFileSync(filePath);
    const stat = fs.statSync(filePath);
    return {
      name: path.basename(filePath),
      content: `[文件: ${path.basename(filePath)}, 大小: ${(stat.size / 1024).toFixed(1)}KB]`,
      mimeType: 'application/octet-stream',
      size: stat.size,
    };
  }
});

// --- 应用生命周期 ---
app.whenReady().then(() => {
  createWindow();
});

app.on('window-all-closed', () => app.quit());
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
