import React, { useState, useEffect } from 'react';
import type { AgentPersona } from '../types';

interface Props {
  onClose: () => void;
  onSwitch: (persona: AgentPersona) => void;
}

const PersonaPanel: React.FC<Props> = ({ onClose, onSwitch }) => {
  const [personas, setPersonas] = useState<AgentPersona[]>([]);
  const [activeId, setActiveId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    avatar: '🤖',
    description: '',
    systemPrompt: '',
  });

  useEffect(() => {
    (async () => {
      const all = await window.electronAPI.personas.getAll();
      setPersonas(all);
      const active = await window.electronAPI.personas.getActive();
      setActiveId(active.id);
    })();
  }, []);

  const handleSwitch = async (persona: AgentPersona) => {
    await window.electronAPI.personas.setActive(persona.id);
    setActiveId(persona.id);
    onSwitch(persona);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ name: '', avatar: '🤖', description: '', systemPrompt: '' });
    setShowForm(true);
  };

  const openEdit = (persona: AgentPersona) => {
    setEditingId(persona.id);
    setForm({
      name: persona.name,
      avatar: persona.avatar,
      description: persona.description,
      systemPrompt: persona.systemPrompt,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    if (editingId) {
      await window.electronAPI.personas.updatePersona(editingId, { ...form });
    } else {
      await window.electronAPI.personas.addCustom({ ...form });
    }
    const all = await window.electronAPI.personas.getAll();
    setPersonas(all);
    setShowForm(false);
  };

  const handleRemove = async (persona: AgentPersona) => {
    if (persona.isBuiltIn) return;
    if (!confirm(`确定删除「${persona.name}」吗？`)) return;
    await window.electronAPI.personas.removePersona(persona.id);
    const all = await window.electronAPI.personas.getAll();
    setPersonas(all);
    if (activeId === persona.id) {
      const active = await window.electronAPI.personas.getActive();
      setActiveId(active.id);
    }
  };

  const updateForm = (key: string, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="panel-side persona-panel">
      <div className="panel-header">
        <h2>🎭 智能体角色</h2>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>

      <div className="panel-body">
        {!showForm ? (
          <div className="persona-list">
            {personas.map(persona => (
              <div
                key={persona.id}
                className={`persona-card ${persona.id === activeId ? 'active' : ''}`}
                onClick={() => handleSwitch(persona)}
              >
                <div className="persona-avatar">{persona.avatar}</div>
                <div className="persona-info">
                  <div className="persona-name">
                    {persona.name}
                    {persona.isBuiltIn && <span className="badge-builtin">内置</span>}
                    {persona.id === activeId && <span className="badge-active">使用中</span>}
                  </div>
                  <div className="persona-desc">{persona.description}</div>
                </div>
                {!persona.isBuiltIn && (
                  <div className="persona-actions">
                    <button className="icon-btn" onClick={e => { e.stopPropagation(); openEdit(persona); }} title="编辑">✏️</button>
                    <button className="icon-btn" onClick={e => { e.stopPropagation(); handleRemove(persona); }} title="删除">🗑️</button>
                  </div>
                )}
              </div>
            ))}

            <button className="btn btn-primary add-persona-btn" onClick={openCreate}>
              ➕ 添加自定义角色
            </button>
          </div>
        ) : (
          <div className="persona-form">
            <h3>{editingId ? '编辑角色' : '创建新角色'}</h3>

            <div className="setting-group">
              <label>头像 (Emoji)</label>
              <input
                className="setting-input"
                value={form.avatar}
                onChange={e => updateForm('avatar', e.target.value)}
                placeholder="🤖" maxLength={4}
              />
            </div>

            <div className="setting-group">
              <label>角色名称</label>
              <input
                className="setting-input"
                value={form.name}
                onChange={e => updateForm('name', e.target.value)}
                placeholder="例如: 法律顾问"
              />
            </div>

            <div className="setting-group">
              <label>描述</label>
              <input
                className="setting-input"
                value={form.description}
                onChange={e => updateForm('description', e.target.value)}
                placeholder="简短描述角色特点"
              />
            </div>

            <div className="setting-group">
              <label>系统提示词</label>
              <textarea
                className="setting-textarea"
                value={form.systemPrompt}
                onChange={e => updateForm('systemPrompt', e.target.value)}
                placeholder="定义这个角色的行为、能力和回答风格..."
                rows={6}
              />
            </div>

            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={!form.name.trim()}>
                {editingId ? '保存' : '创建'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PersonaPanel;
