import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { KnowledgeDocument, KBStats, KBProgressEvent } from '../types';

interface Props {
  onClose: () => void;
}

const KnowledgePanel: React.FC<Props> = ({ onClose }) => {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [stats, setStats] = useState<KBStats>({ documentCount: 0, chunkCount: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const cleanupRef = useRef<(() => void) | null>(null);

  const refresh = useCallback(async () => {
    const docs = await window.electronAPI.kb.getDocuments();
    setDocuments(docs);
    const s = await window.electronAPI.kb.getStats();
    setStats(s);
  }, []);

  useEffect(() => {
    refresh();

    cleanupRef.current = window.electronAPI.kb.onProgress((event: KBProgressEvent) => {
      if (event.type === 'indexing') {
        setProgressMsg(`正在索引: ${event.fileName}...`);
      } else if (event.type === 'done') {
        setProgressMsg(`✅ ${event.fileName} 索引完成 (${event.chunkCount} 个片段)`);
        refresh();
        setTimeout(() => setProgressMsg(''), 3000);
      } else if (event.type === 'error') {
        setProgressMsg(`❌ ${event.fileName} 索引失败: ${event.error}`);
        setTimeout(() => setProgressMsg(''), 5000);
      }
    });

    return () => {
      cleanupRef.current?.();
    };
  }, [refresh]);

  const handleAdd = async () => {
    setIsLoading(true);
    setProgressMsg('正在选择文件...');
    try {
      const result = await window.electronAPI.kb.addDocument();
      if (result.success) {
        setProgressMsg(`成功添加 ${result.data!.length} 个文档`);
        await refresh();
        setTimeout(() => setProgressMsg(''), 3000);
      } else if (result.error && result.error !== '未选择文件') {
        setProgressMsg(`❌ ${result.error}`);
        setTimeout(() => setProgressMsg(''), 5000);
      } else {
        setProgressMsg('');
      }
    } catch (e: any) {
      setProgressMsg(`❌ ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemove = async (doc: KnowledgeDocument) => {
    if (!confirm(`确定删除「${doc.name}」吗？`)) return;
    await window.electronAPI.kb.removeDocument(doc.id);
    await refresh();
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="kb-panel">
      <div className="kb-header">
        <h2>📚 知识库管理</h2>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>

      <div className="kb-body">
        {/* 统计信息 */}
        <div className="kb-stats">
          <div className="stat-item">
            <span className="stat-value">{stats.documentCount}</span>
            <span className="stat-label">文档数</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{stats.chunkCount}</span>
            <span className="stat-label">片段数</span>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="kb-actions">
          <button
            className="btn btn-primary"
            onClick={handleAdd}
            disabled={isLoading}
          >
            {isLoading ? '索引中...' : '📂 添加文件'}
          </button>
        </div>

        {/* 进度消息 */}
        {progressMsg && (
          <div className="kb-progress">
            {progressMsg}
          </div>
        )}

        {/* 文档列表 */}
        <div className="kb-doc-list">
          {documents.length === 0 ? (
            <div className="kb-empty">
              <p>知识库为空</p>
              <small>点击上方按钮添加文档，支持 .txt .md .csv .json 等格式</small>
            </div>
          ) : (
            documents.map(doc => (
              <div key={doc.id} className="kb-doc-item">
                <div className="doc-info">
                  <div className="doc-name">📄 {doc.name}</div>
                  <div className="doc-meta">
                    {doc.chunkCount} 个片段 · {formatDate(doc.addedAt)}
                  </div>
                </div>
                <button
                  className="doc-remove-btn"
                  onClick={() => handleRemove(doc)}
                  title="删除"
                >
                  🗑️
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default KnowledgePanel;
