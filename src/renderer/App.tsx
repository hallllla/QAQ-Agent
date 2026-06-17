import { useState, useEffect, useRef, useCallback } from 'react';
import type { Message, ToolEvent, AgentSettings, ChatAttachment, AgentPersona } from './types';
import ChatWindow from './components/ChatWindow';
import SettingsPanel from './components/SettingsPanel';
import KnowledgePanel from './components/KnowledgePanel';
import PersonaPanel from './components/PersonaPanel';
import SkillsPanel from './components/SkillsPanel';

type PanelName = 'settings' | 'knowledge' | 'personas' | 'skills';

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [activePanel, setActivePanel] = useState<PanelName | null>(null);
  const [settings, setSettings] = useState<AgentSettings>({
    provider: 'openai',
    apiKey: '',
    model: 'gpt-4o-mini',
    baseUrl: '',
    temperature: 0.7,
    maxContextMessages: 20,
  });
  const [activePersona, setActivePersona] = useState<AgentPersona | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const togglePanel = useCallback((panel: PanelName) => {
    setActivePanel(prev => (prev === panel ? null : panel));
  }, []);

  useEffect(() => {
    (async () => {
      const saved = await window.electronAPI.getSettings();
      if (saved) {
        setSettings(s => ({ ...saved, maxContextMessages: saved.maxContextMessages || 20 }));
      }
      const persona = await window.electronAPI.personas.getActive();
      setActivePersona(persona);

      cleanupRef.current = window.electronAPI.onToolEvent((event: ToolEvent) => {
        setMessages(prev => {
          const idx = prev.findIndex(m => m.role === 'assistant' && m.isLoading);
          if (idx === -1) return prev;
          const updated = [...prev];
          updated[idx] = {
            ...updated[idx],
            toolEvents: [...(updated[idx].toolEvents || []), event],
          };
          return updated;
        });
      });
    })();

    return () => { cleanupRef.current?.(); };
  }, []);

  const handleSend = async (text: string, attachments?: ChatAttachment[]) => {
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      attachments,
      timestamp: Date.now(),
    };

    const assistantId = `assistant-${Date.now()}`;
    const assistantMsg: Message = {
      id: assistantId,
      role: 'assistant',
      content: '正在思考...',
      timestamp: Date.now(),
      isLoading: true,
      toolEvents: [],
    };

    setMessages(prev => [...prev, userMsg, assistantMsg]);

    const chatHistory = [...messages, userMsg]
      .filter(m => !m.isLoading && m.role !== 'system')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    const apiAttachments = attachments?.map(a => ({
      name: a.name,
      dataUrl: a.dataUrl,
      mimeType: a.mimeType,
      type: a.type,
    }));

    const result = await window.electronAPI.chatWithHistory(
      text, apiAttachments, chatHistory
    );

    setMessages(prev => prev.map(m =>
      m.id === assistantId
        ? {
            ...m,
            content: result.success ? result.data!.response : `错误: ${result.error}`,
            isLoading: false,
            isError: !result.success,
            toolCalls: result.success ? result.data!.toolCalls : [],
          }
        : m
    ));
  };

  const handleSaveSettings = async (newSettings: AgentSettings) => {
    await window.electronAPI.saveSettings(newSettings);
    setSettings(newSettings);
    setActivePanel(null);
  };

  const handlePersonaSwitch = (persona: AgentPersona) => {
    setActivePersona(persona);
    setActivePanel(null);
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <div className="logo">{activePersona?.avatar || '🤖'}</div>
          <h1>QAQ</h1>
          {activePersona && (
            <span className="persona-badge" onClick={() => togglePanel('personas')}>
              {activePersona.name}
            </span>
          )}
        </div>
        <div className="header-right">
          <button className="header-btn" onClick={() => setMessages([])} title="清空对话">
            🗑️ 清空
          </button>
          <button className={`header-btn ${activePanel === 'personas' ? 'active' : ''}`}
            onClick={() => togglePanel('personas')} title="智能体角色">
            🎭 角色
          </button>
          <button className={`header-btn ${activePanel === 'skills' ? 'active' : ''}`}
            onClick={() => togglePanel('skills')} title="技能">
            ⚡ 技能
          </button>
          <button className={`header-btn ${activePanel === 'knowledge' ? 'active' : ''}`}
            onClick={() => togglePanel('knowledge')} title="知识库">
            📚 知识库
          </button>
          <button className={`header-btn ${activePanel === 'settings' ? 'active' : ''}`}
            onClick={() => togglePanel('settings')} title="设置">
            ⚙️ 设置
          </button>
        </div>
      </header>

      <div className="app-body">
        {activePanel === 'settings' && (
          <SettingsPanel settings={settings} onSave={handleSaveSettings} onClose={() => setActivePanel(null)} />
        )}
        {activePanel === 'knowledge' && (
          <KnowledgePanel onClose={() => setActivePanel(null)} />
        )}
        {activePanel === 'personas' && (
          <PersonaPanel onClose={() => setActivePanel(null)} onSwitch={handlePersonaSwitch} />
        )}
        {activePanel === 'skills' && (
          <SkillsPanel onClose={() => setActivePanel(null)} />
        )}
        <ChatWindow messages={messages} onSend={handleSend} />
      </div>
    </div>
  );
}
