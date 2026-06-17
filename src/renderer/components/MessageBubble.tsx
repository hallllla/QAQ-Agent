import { useState, useMemo } from 'react';
import type { Message, ToolEvent } from '../types';

interface Props {
  message: Message;
}

export default function MessageBubble({ message }: Props) {
  const [showTools, setShowTools] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');

  const isUser = message.role === 'user';
  const hasToolEvents = !!(message.toolEvents && message.toolEvents.length > 0);
  const imageAttachments = useMemo(
    () => (message.attachments || []).filter(a => a.type === 'image'), [message.attachments]
  );
  const fileAttachments = useMemo(
    () => (message.attachments || []).filter(a => a.type === 'file'), [message.attachments]
  );

  const toolPairs = useMemo(() => {
    const pairs: Array<{ start: ToolEvent; end?: ToolEvent }> = [];
    if (!hasToolEvents) return pairs;
    for (const event of message.toolEvents!) {
      if (event.type === 'tool_start') {
        pairs.push({ start: event });
      } else if (event.type === 'tool_end') {
        const lastPair = pairs.find(p => p.start.toolName === event.toolName && !p.end);
        if (lastPair) lastPair.end = event;
      }
    }
    return pairs;
  }, [message.toolEvents, hasToolEvents]);

  const formattedTime = new Date(message.timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <>
      <div className={`message-row ${isUser ? 'user-row' : 'assistant-row'}`}>
        <div className={`message-bubble ${isUser ? 'user-bubble' : 'assistant-bubble'}`}>
          <div className="avatar">{isUser ? '👤' : '🤖'}</div>
          <div className="bubble-content">
            {imageAttachments.length > 0 && (
              <div className="message-images">
                {imageAttachments.map(img => (
                  <img key={img.id} src={img.dataUrl} className="message-image"
                    onClick={() => setPreviewUrl(img.dataUrl)} />
                ))}
              </div>
            )}
            {fileAttachments.length > 0 && (
              <div className="message-files">
                {fileAttachments.map(f => (
                  <div key={f.id} className="file-chip">
                    📄 {f.name}
                    {f.size && <small> ({(f.size / 1024).toFixed(1)}KB)</small>}
                  </div>
                ))}
              </div>
            )}
            <div className={`message-text ${message.isLoading ? 'loading' : ''} ${message.isError ? 'error' : ''}`}>
              {message.isLoading ? (
                <div className="loading-indicator">
                  <span className="dot" /><span className="dot" /><span className="dot" />
                </div>
              ) : (
                <div className="text-content">{message.content}</div>
              )}
            </div>
            {hasToolEvents && (
              <div className="tool-events">
                <button className="tool-toggle" onClick={() => setShowTools(!showTools)}>
                  🔧 工具调用 ({toolPairs.length}) {showTools ? '▼' : '▶'}
                </button>
                {showTools && (
                  <div className="tool-details">
                    {toolPairs.map((pair, idx) => (
                      <div key={idx} className="tool-card">
                        <div className="tool-header">
                          <span className="tool-name">📌 {pair.start.toolName}</span>
                          <span className={`tool-status ${pair.end ? '' : 'running'}`}>
                            {pair.end ? '✅' : '⏳'}
                          </span>
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
            <div className="message-time">{formattedTime}</div>
          </div>
        </div>
      </div>
      {previewUrl && (
        <div className="image-preview-overlay" onClick={() => setPreviewUrl('')}>
          <img src={previewUrl} className="preview-image" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}
