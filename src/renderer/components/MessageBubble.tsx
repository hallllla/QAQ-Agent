import React, { useState } from 'react';
import type { Message, ToolEvent } from '../types';

interface MessageBubbleProps {
  message: Message;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const [showTools, setShowTools] = useState(false);
  const isUser = message.role === 'user';
  const hasToolEvents = message.toolEvents && message.toolEvents.length > 0;

  // 将 tool events 配对 (start + end)
  const toolPairs: Array<{ start: ToolEvent; end?: ToolEvent }> = [];
  if (hasToolEvents) {
    for (const event of message.toolEvents!) {
      if (event.type === 'tool_start') {
        toolPairs.push({ start: event });
      } else if (event.type === 'tool_end') {
        const lastPair = toolPairs.find(
          (p) => p.start.toolName === event.toolName && !p.end
        );
        if (lastPair) {
          lastPair.end = event;
        }
      }
    }
  }

  return (
    <div className={`message-row ${isUser ? 'user-row' : 'assistant-row'}`}>
      <div className={`message-bubble ${isUser ? 'user-bubble' : 'assistant-bubble'}`}>
        {/* 头像 */}
        <div className="avatar">
          {isUser ? '👤' : '🤖'}
        </div>

        <div className="bubble-content">
          {/* 消息文本 */}
          <div className={`message-text ${message.isLoading ? 'loading' : ''} ${message.isError ? 'error' : ''}`}>
            {message.isLoading ? (
              <div className="loading-indicator">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
              </div>
            ) : (
              <div className="text-content">{message.content}</div>
            )}
          </div>

          {/* 工具调用展示 */}
          {hasToolEvents && (
            <div className="tool-events">
              <button
                className="tool-toggle"
                onClick={() => setShowTools(!showTools)}
              >
                🔧 工具调用 ({toolPairs.length}) {showTools ? '▼' : '▶'}
              </button>

              {showTools && (
                <div className="tool-details">
                  {toolPairs.map((pair, idx) => (
                    <div key={idx} className="tool-card">
                      <div className="tool-header">
                        <span className="tool-name">📌 {pair.start.toolName}</span>
                        {pair.end && <span className="tool-status">✅</span>}
                        {!pair.end && <span className="tool-status running">⏳</span>}
                      </div>
                      {pair.start.input && (
                        <div className="tool-section">
                          <span className="tool-label">输入:</span>
                          <pre className="tool-code">{pair.start.input}</pre>
                        </div>
                      )}
                      {pair.end?.output && (
                        <div className="tool-section">
                          <span className="tool-label">输出:</span>
                          <pre className="tool-code">{pair.end.output}</pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 时间戳 */}
          <div className="message-time">
            {new Date(message.timestamp).toLocaleTimeString('zh-CN', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
