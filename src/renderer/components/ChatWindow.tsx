import React, { useState, useRef, useEffect } from 'react';
import type { Message } from '../types';
import MessageBubble from './MessageBubble';

interface ChatWindowProps {
  messages: Message[];
  onSend: (text: string) => void;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ messages, onSend }) => {
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 自动调整输入框高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [input]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isSending) return;

    setInput('');
    setIsSending(true);

    try {
      await onSend(text);
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

  return (
    <div className="chat-window">
      {/* 消息列表 */}
      <div className="messages-container">
        {messages.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">🤖</div>
            <h2>LangGraph Agent</h2>
            <p>一个基于 LangGraph 的桌面 AI 助手</p>
            <div className="suggestions">
              <button onClick={() => onSend('帮我算一下 (123 + 456) * 7 等于多少')}>
                🧮 帮我算一下 (123 + 456) * 7
              </button>
              <button onClick={() => onSend('现在几点了？')}>
                🕐 现在几点了？
              </button>
              <button onClick={() => onSend('帮我分析一下这段文字: Hello World 你好世界 12345')}>
                📝 分析一段文字
              </button>
              <button onClick={() => onSend('生成一个 1 到 100 之间的随机数')}>
                🎲 生成随机数
              </button>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 */}
      <div className="input-area">
        <div className="input-wrapper">
          <textarea
            ref={textareaRef}
            className="message-input"
            placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={isSending}
          />
          <button
            className="send-btn"
            onClick={handleSend}
            disabled={!input.trim() || isSending}
          >
            {isSending ? (
              <span className="spinner" />
            ) : (
              <span>发送</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;
