import React, { useState, useEffect } from 'react';
import type { Message, ToolEvent, AgentSettings } from './types';
import ChatWindow from './components/ChatWindow';
import SettingsPanel from './components/SettingsPanel';

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<AgentSettings>({
    provider: 'openai',
    apiKey: '',
    model: 'gpt-4o-mini',
    baseUrl: '',
    temperature: 0.7,
  });

  // 加载设置
  useEffect(() => {
    window.electronAPI.getSettings().then((saved) => {
      if (saved) setSettings(saved);
    });
  }, []);

  // 监听工具事件
  useEffect(() => {
    const cleanup = window.electronAPI.onToolEvent((event: ToolEvent) => {
      setMessages((prev) => {
        const updated = [...prev];
        const lastAssistant = updated.findIndex(
          (m) => m.role === 'assistant' && m.isLoading
        );
        if (lastAssistant !== -1) {
          const msg = { ...updated[lastAssistant] };
          msg.toolEvents = [...(msg.toolEvents || []), event];
          updated[lastAssistant] = msg;
        }
        return updated;
      });
    });
    return cleanup;
  }, []);

  const handleSend = async (text: string) => {
    // 添加用户消息
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);

    // 添加加载中的助手消息
    const assistantMsg: Message = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: '正在思考...',
      timestamp: Date.now(),
      isLoading: true,
      toolEvents: [],
    };
    setMessages((prev) => [...prev, assistantMsg]);

    // 调用 Agent
    const result = await window.electronAPI.chat(text);

    // 更新助手消息
    setMessages((prev) => {
      const updated = [...prev];
      const idx = updated.findIndex((m) => m.id === assistantMsg.id);
      if (idx !== -1) {
        updated[idx] = {
          ...updated[idx],
          content: result.success
            ? result.data!.response
            : `错误: ${result.error}`,
          isLoading: false,
          isError: !result.success,
          toolCalls: result.success ? result.data!.toolCalls : [],
        };
      }
      return updated;
    });
  };

  const handleSaveSettings = async (newSettings: AgentSettings) => {
    await window.electronAPI.saveSettings(newSettings);
    setSettings(newSettings);
    setShowSettings(false);
  };

  const handleClearChat = () => {
    setMessages([]);
  };

  return (
    <div className="app">
      {/* 顶部标题栏 */}
      <header className="app-header">
        <div className="header-left">
          <div className="logo">🤖</div>
          <h1>LangGraph Agent</h1>
        </div>
        <div className="header-right">
          <button
            className="header-btn"
            onClick={handleClearChat}
            title="清空对话"
          >
            🗑️ 清空
          </button>
          <button
            className={`header-btn ${showSettings ? 'active' : ''}`}
            onClick={() => setShowSettings(!showSettings)}
            title="设置"
          >
            ⚙️ 设置
          </button>
        </div>
      </header>

      <div className="app-body">
        {/* 设置面板 */}
        {showSettings && (
          <SettingsPanel
            settings={settings}
            onSave={handleSaveSettings}
            onClose={() => setShowSettings(false)}
          />
        )}

        {/* 聊天窗口 */}
        <ChatWindow messages={messages} onSend={handleSend} />
      </div>
    </div>
  );
};

export default App;
