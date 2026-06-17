import { useState, useRef, useEffect } from 'react';
import type { Message, ChatAttachment } from '../types';
import MessageBubble from './MessageBubble';

interface Props {
  messages: Message[];
  onSend: (text: string, attachments?: ChatAttachment[]) => void;
}

export default function ChatWindow({ messages, onSend }: Props) {
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingAttachments]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [input]);

  const handleSend = async () => {
    const text = input.trim();
    if ((!text && pendingAttachments.length === 0) || isSending) return;

    const attachments = pendingAttachments.length > 0 ? [...pendingAttachments] : undefined;
    setInput('');
    setPendingAttachments([]);
    setIsSending(true);

    try {
      await onSend(text, attachments);
    } finally {
      setIsSending(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestion = (text: string) => onSend(text);

  const handlePickImage = async () => {
    const result = await window.electronAPI.media.pickImage();
    if (result) {
      setPendingAttachments(prev => [...prev, {
        id: `img-${Date.now()}`, type: 'image', name: result.name,
        dataUrl: result.dataUrl, mimeType: result.mimeType,
      }]);
    }
  };

  const handlePickFile = async () => {
    const result = await window.electronAPI.media.pickFile();
    if (result) {
      setPendingAttachments(prev => [...prev, {
        id: `file-${Date.now()}`, type: 'file', name: result.name,
        dataUrl: result.content, mimeType: result.mimeType, size: result.size,
      }]);
    }
  };

  const removeAttachment = (id: string) => {
    setPendingAttachments(prev => prev.filter(a => a.id !== id));
  };

  return (
    <div className="chat-window">
      <div className="messages-container">
        {messages.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">🤖</div>
            <h2>QAQ</h2>
            <p>一个支持多模态的桌面 AI 助手</p>
            <div className="suggestions">
              <button onClick={() => handleSuggestion('帮我算一下 (123 + 456) * 7 等于多少')}>🧮 数学计算</button>
              <button onClick={() => handleSuggestion('现在几点了？')}>🕐 当前时间</button>
              <button onClick={() => handleSuggestion('帮我分析一下这段文字: Hello World 你好世界 12345')}>📝 文本分析</button>
              <button onClick={() => handleSuggestion('生成一个 1 到 100 之间的随机数')}>🎲 随机数</button>
            </div>
          </div>
        )}
        {messages.map(msg => <MessageBubble key={msg.id} message={msg} />)}
        <div ref={messagesEndRef} />
      </div>

      {pendingAttachments.length > 0 && (
        <div className="attachments-preview">
          {pendingAttachments.map(att => (
            <div key={att.id} className="attachment-chip">
              {att.type === 'image'
                ? <img src={att.dataUrl} className="attachment-thumb" />
                : <span className="attachment-icon">📄</span>}
              <span className="attachment-name">{att.name}</span>
              <button className="attachment-remove" onClick={() => removeAttachment(att.id)}>✕</button>
            </div>
          ))}
        </div>
      )}

      <div className="input-area">
        <div className="input-toolbar">
          <button className="toolbar-btn" onClick={handlePickImage} title="添加图片">🖼️</button>
          <button className="toolbar-btn" onClick={handlePickFile} title="添加文件">📎</button>
        </div>
        <div className="input-wrapper">
          <textarea
            ref={textareaRef}
            className="message-input"
            placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={isSending}
          />
          <button
            className="send-btn"
            onClick={handleSend}
            disabled={(!input.trim() && pendingAttachments.length === 0) || isSending}
          >
            {isSending ? <span className="spinner" /> : <span>发送</span>}
          </button>
        </div>
      </div>
    </div>
  );
}
