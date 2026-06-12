import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import { runAgent, type AgentSettings, type ToolEvent } from './agent.js';

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
    title: 'LangGraph Agent',
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

// --- IPC 处理 ---
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

ipcMain.handle('settings:get', () => {
  return currentSettings;
});

ipcMain.handle('settings:save', (_event, settings: AgentSettings) => {
  currentSettings = settings;
  saveSettings(settings);
  return true;
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
