import React, { useState, useEffect } from 'react';
import type { AgentSettings } from '../types';

interface Props {
  settings: AgentSettings;
  onSave: (settings: AgentSettings) => void;
  onClose: () => void;
}

const SettingsPanel: React.FC<Props> = ({ settings, onSave, onClose }) => {
  const [form, setForm] = useState<AgentSettings>({ ...settings });

  useEffect(() => {
    setForm({ ...settings });
  }, [settings]);

  const handleSave = () => {
    onSave({ ...form });
  };

  const updateField = <K extends keyof AgentSettings>(key: K, value: AgentSettings[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <h2>⚙️ Agent 设置</h2>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>

      <div className="settings-body">
        {/* LLM 提供商 */}
        <div className="setting-group">
          <label>LLM 提供商</label>
          <div className="radio-group">
            <label className={`radio-option ${form.provider === 'openai' ? 'active' : ''}`}>
              <input
                type="radio" name="provider" value="openai"
                checked={form.provider === 'openai'}
                onChange={() => updateField('provider', 'openai')}
              />
              <span>OpenAI</span>
            </label>
            <label className={`radio-option ${form.provider === 'ollama' ? 'active' : ''}`}>
              <input
                type="radio" name="provider" value="ollama"
                checked={form.provider === 'ollama'}
                onChange={() => updateField('provider', 'ollama')}
              />
              <span>Ollama (本地)</span>
            </label>
          </div>
        </div>

        {/* API Key */}
        {form.provider === 'openai' && (
          <div className="setting-group">
            <label>API Key</label>
            <input
              type="password" className="setting-input"
              value={form.apiKey}
              onChange={e => updateField('apiKey', e.target.value)}
              placeholder="sk-..."
            />
            <small>支持 OpenAI 及兼容 API 的密钥</small>
          </div>
        )}

        {/* 模型名称 */}
        <div className="setting-group">
          <label>模型名称</label>
          <input
            type="text" className="setting-input"
            value={form.model}
            onChange={e => updateField('model', e.target.value)}
            placeholder={form.provider === 'openai' ? 'gpt-4o-mini' : 'llama3.1'}
          />
          <small>
            {form.provider === 'openai'
              ? '例如: gpt-4o, gpt-4o-mini, gpt-3.5-turbo'
              : '例如: llama3.1, mistral, qwen2.5'}
          </small>
        </div>

        {/* Base URL */}
        <div className="setting-group">
          <label>{form.provider === 'openai' ? '自定义 API 地址 (可选)' : 'Ollama 地址'}</label>
          <input
            type="text" className="setting-input"
            value={form.baseUrl}
            onChange={e => updateField('baseUrl', e.target.value)}
            placeholder={form.provider === 'openai' ? 'https://api.openai.com/v1 (默认)' : 'http://localhost:11434'}
          />
          <small>
            {form.provider === 'openai'
              ? '留空使用 OpenAI 官方地址，可填入兼容 API 地址'
              : '本地 Ollama 服务地址'}
          </small>
        </div>

        {/* Temperature */}
        <div className="setting-group">
          <label>Temperature: {form.temperature}</label>
          <input
            type="range" className="setting-range"
            min="0" max="2" step="0.1"
            value={form.temperature}
            onChange={e => updateField('temperature', parseFloat(e.target.value))}
          />
          <div className="range-labels">
            <span>精确 (0)</span>
            <span>创意 (2)</span>
          </div>
        </div>

        {/* 上下文窗口大小 */}
        <div className="setting-group">
          <label>上下文窗口: {form.maxContextMessages} 条消息</label>
          <input
            type="range" className="setting-range"
            min="1" max="100" step="1"
            value={form.maxContextMessages}
            onChange={e => updateField('maxContextMessages', parseInt(e.target.value, 10))}
          />
          <div className="range-labels">
            <span>1 条</span>
            <span>100 条</span>
          </div>
          <small>对话时保留的最近消息数。数值越大上下文越丰富，但消耗更多 token</small>
        </div>
      </div>

      <div className="settings-footer">
        <button className="btn btn-secondary" onClick={onClose}>取消</button>
        <button className="btn btn-primary" onClick={handleSave}>保存设置</button>
      </div>
    </div>
  );
};

export default SettingsPanel;
