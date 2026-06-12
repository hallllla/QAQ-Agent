import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Agent 对话
  chat: (message: string) => ipcRenderer.invoke('agent:chat', message),

  // 监听工具调用事件
  onToolEvent: (callback: (event: any) => void) => {
    const listener = (_event: any, data: any) => callback(data);
    ipcRenderer.on('agent:tool-event', listener);
    return () => ipcRenderer.removeListener('agent:tool-event', listener);
  },

  // 设置
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: any) => ipcRenderer.invoke('settings:save', settings),
});
