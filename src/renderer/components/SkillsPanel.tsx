import React, { useState, useEffect } from 'react';
import type { Skill } from '../types';
import { api } from '../api';

interface Props {
  onClose: () => void;
}

const SkillsPanel: React.FC<Props> = ({ onClose }) => {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    icon: '⚡',
    description: '',
    prompt: '',
    enabled: true,
  });

  useEffect(() => {
    refresh();
  }, []);

  const refresh = async () => {
    const all = await api.skills.getAll();
    setSkills(all);
  };

  const handleToggle = async (skill: Skill) => {
    await api.skills.toggle(skill.id, !skill.enabled);
    await refresh();
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ name: '', icon: '⚡', description: '', prompt: '', enabled: true });
    setShowForm(true);
  };

  const openEdit = (skill: Skill) => {
    setEditingId(skill.id);
    setForm({
      name: skill.name,
      icon: skill.icon,
      description: skill.description,
      prompt: skill.prompt,
      enabled: skill.enabled,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    if (editingId) {
      await api.skills.updateSkill(editingId, { ...form });
    } else {
      await api.skills.addSkill({
        ...form,
        parameters: [],
      });
    }
    await refresh();
    setShowForm(false);
  };

  const handleRemove = async (skill: Skill) => {
    if (skill.isBuiltIn) return;
    if (!confirm(`确定删除技能「${skill.name}」吗？`)) return;
    await api.skills.removeSkill(skill.id);
    await refresh();
  };

  const updateForm = (key: string, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="panel-side skills-panel">
      <div className="panel-header">
        <h2>⚡ 技能管理</h2>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>

      <div className="panel-body">
        {!showForm ? (
          <div className="skill-list">
            {skills.map(skill => (
              <div
                key={skill.id}
                className={`skill-card ${!skill.enabled ? 'disabled' : ''}`}
              >
                <div className="skill-icon">{skill.icon}</div>
                <div className="skill-info">
                  <div className="skill-name">
                    {skill.name}
                    {skill.isBuiltIn && <span className="badge-builtin">内置</span>}
                  </div>
                  <div className="skill-desc">{skill.description}</div>
                </div>
                <div className="skill-controls">
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={skill.enabled}
                      onChange={() => handleToggle(skill)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                  {!skill.isBuiltIn && (
                    <>
                      <button className="icon-btn" onClick={() => openEdit(skill)} title="编辑">✏️</button>
                      <button className="icon-btn" onClick={() => handleRemove(skill)} title="删除">🗑️</button>
                    </>
                  )}
                </div>
              </div>
            ))}

            <button className="btn btn-primary add-skill-btn" onClick={openCreate}>
              ➕ 添加自定义技能
            </button>
          </div>
        ) : (
          <div className="skill-form">
            <h3>{editingId ? '编辑技能' : '创建新技能'}</h3>

            <div className="setting-group">
              <label>图标 (Emoji)</label>
              <input
                className="setting-input"
                value={form.icon}
                onChange={e => updateForm('icon', e.target.value)}
                placeholder="⚡" maxLength={4}
              />
            </div>

            <div className="setting-group">
              <label>技能名称</label>
              <input
                className="setting-input"
                value={form.name}
                onChange={e => updateForm('name', e.target.value)}
                placeholder="例如: 论文润色"
              />
            </div>

            <div className="setting-group">
              <label>描述</label>
              <input
                className="setting-input"
                value={form.description}
                onChange={e => updateForm('description', e.target.value)}
                placeholder="简短描述技能功能"
              />
            </div>

            <div className="setting-group">
              <label>提示词模板</label>
              <textarea
                className="setting-textarea"
                value={form.prompt}
                onChange={e => updateForm('prompt', e.target.value)}
                placeholder="技能激活后注入的提示词..."
                rows={5}
              />
              <small>这个提示词会告诉 AI 如何使用此技能</small>
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

export default SkillsPanel;
