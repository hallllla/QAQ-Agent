import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { runAgent, type AgentSettings, type ToolEvent } from './agent.js';
import { knowledgeBase } from './knowledge.js';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

let mainWindow: BrowserWindow | null = null;

// --- 设置持久化 ---
const settingsPath = path.join(app.getPath('userData'), 'agent-settings.json');

function loadSettings(): AgentSettings {
  try {
    const data = fs.readFileSync(settingsPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {
      provider: 'openai',
      apiKey: '',
      model: 'gpt-4o-mini',
      baseUrl: '',
      temperature: 0.7,
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
ipcMain.handle('agent:chat', async (_event, message: string) => {
  try {
    const results = await runAgent(message, currentSettings, (event: ToolEvent) => {
      mainWindow?.webContents.send('agent:tool-event', event);
    });
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
ipcMain.handle('kb:get-documents', () => {
  return knowledgeBase.getDocuments();
});

ipcMain.handle('kb:add-document', async () => {
  if (!mainWindow) return { success: false, error: '窗口未就绪' };

  // 打开文件选择对话框
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
      mainWindow.webContents.send('kb:progress', {
        type: 'indexing',
        fileName: path.basename(filePath),
      });
      const doc = await knowledgeBase.addDocument(filePath, currentSettings);
      addedDocs.push(doc);
      mainWindow.webContents.send('kb:progress', {
        type: 'done',
        fileName: path.basename(filePath),
        chunkCount: doc.chunkCount,
      });
    } catch (e: any) {
      mainWindow.webContents.send('kb:progress', {
        type: 'error',
        fileName: path.basename(filePath),
        error: e.message,
      });
      return { success: false, error: `索引 ${path.basename(filePath)} 失败: ${e.message}` };
    }
  }

  return { success: true, data: addedDocs };
});

ipcMain.handle('kb:remove-document', (_event, docId: string) => {
  const ok = knowledgeBase.removeDocument(docId);
  return { success: ok };
});

ipcMain.handle('kb:get-stats', () => {
  return knowledgeBase.getStats();
});

// --- 应用生命周期 ---
app.whenReady().then(() => {
  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
