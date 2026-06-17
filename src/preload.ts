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

  // 知识库
  kb: {
    getDocuments: () => ipcRenderer.invoke('kb:get-documents'),
    addDocument: () => ipcRenderer.invoke('kb:add-document'),
    removeDocument: (docId: string) => ipcRenderer.invoke('kb:remove-document', docId),
    getStats: () => ipcRenderer.invoke('kb:get-stats'),
    onProgress: (callback: (data: any) => void) => {
      const listener = (_event: any, data: any) => callback(data);
      ipcRenderer.on('kb:progress', listener);
      return () => ipcRenderer.removeListener('kb:progress', listener);
    },
  },
});
