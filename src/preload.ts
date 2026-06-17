import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Agent 对话 (支持附件)
  chat: (message: string, attachments?: any[]) =>
    ipcRenderer.invoke('agent:chat', message, attachments),

  // 带历史的对话
  chatWithHistory: (message: string, attachments?: any[], history?: any[]) =>
    ipcRenderer.invoke('agent:chat-history', message, attachments, history),

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

  // 智能体角色
  personas: {
    getAll: () => ipcRenderer.invoke('persona:get-all'),
    getActive: () => ipcRenderer.invoke('persona:get-active'),
    setActive: (id: string) => ipcRenderer.invoke('persona:set-active', id),
    addCustom: (persona: any) => ipcRenderer.invoke('persona:add-custom', persona),
    removePersona: (id: string) => ipcRenderer.invoke('persona:remove', id),
    updatePersona: (id: string, updates: any) => ipcRenderer.invoke('persona:update', id, updates),
  },

  // 技能管理
  skills: {
    getAll: () => ipcRenderer.invoke('skill:get-all'),
    toggle: (id: string, enabled: boolean) => ipcRenderer.invoke('skill:toggle', id, enabled),
    addSkill: (skill: any) => ipcRenderer.invoke('skill:add', skill),
    updateSkill: (id: string, updates: any) => ipcRenderer.invoke('skill:update', id, updates),
    removeSkill: (id: string) => ipcRenderer.invoke('skill:remove', id),
  },

  // 图片/文件处理
  media: {
    pickImage: () => ipcRenderer.invoke('media:pick-image'),
    pickFile: () => ipcRenderer.invoke('media:pick-file'),
  },
});
