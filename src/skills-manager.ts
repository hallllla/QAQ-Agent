import fs from 'fs';
import path from 'path';
import { app } from 'electron';

// ============================================================
// 类型定义
// ============================================================

export interface Skill {
  id: string;
  name: string;
  icon: string;
  description: string;
  /** 技能触发后的提示词，注入到系统提示中 */
  prompt: string;
  /** 技能参数定义，JSON Schema 简化版 */
  parameters: SkillParameter[];
  /** 是否启用 */
  enabled: boolean;
  isBuiltIn: boolean;
  createdAt: string;
}

export interface SkillParameter {
  name: string;
  type: 'string' | 'number' | 'boolean';
  description: string;
  required: boolean;
  default?: string | number | boolean;
}

// ============================================================
// 默认技能
// ============================================================

const DEFAULT_SKILLS: Skill[] = [
  {
    id: 'code-review',
    name: '代码审查',
    icon: '🔍',
    description: '对代码进行审查，发现问题和优化建议',
    prompt: '请以资深开发者的视角对以下代码进行审查，指出潜在的问题、安全漏洞和可优化项，并给出修改建议。',
    parameters: [
      { name: 'code', type: 'string', description: '要审查的代码', required: true },
    ],
    enabled: true,
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'summarize',
    name: '内容摘要',
    icon: '📋',
    description: '将长文本压缩为简洁摘要',
    prompt: '请将以下内容提炼为简洁、有条理的摘要，保留关键信息，去除冗余内容。摘要应包含核心观点，并用清晰的条目呈现。',
    parameters: [
      { name: 'content', type: 'string', description: '要摘要的内容', required: true },
    ],
    enabled: true,
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'explain',
    name: '概念解释',
    icon: '💡',
    description: '用通俗易懂的语言解释复杂概念',
    prompt: '请用通俗易懂的语言解释以下概念，可以用类比、举例等方式帮助理解。确保解释准确、清晰、有趣。',
    parameters: [
      { name: 'concept', type: 'string', description: '要解释的概念', required: true },
    ],
    enabled: true,
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'brainstorm',
    name: '头脑风暴',
    icon: '🧠',
    description: '针对主题进行发散性思维，生成创意方案',
    prompt: '请围绕以下主题进行头脑风暴，尽可能多地生成创意方案、角度和思路。每个方案用简短标题 + 一段描述的形式呈现，按创新性和可行性排序。',
    parameters: [
      { name: 'topic', type: 'string', description: '头脑风暴的主题', required: true },
    ],
    enabled: true,
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
  },
];

// ============================================================
// 技能管理器
// ============================================================

class SkillsManager {
  private skills: Skill[] = [];
  private dataPath: string;

  constructor() {
    const dir = path.join(app.getPath('userData'), 'skills');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    this.dataPath = path.join(dir, 'skills.json');
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(this.dataPath)) {
        const saved = JSON.parse(fs.readFileSync(this.dataPath, 'utf-8')) as Skill[];
        this.skills = [...DEFAULT_SKILLS];
        for (const s of saved) {
          if (!s.isBuiltIn) this.skills.push(s);
        }
      } else {
        this.skills = [...DEFAULT_SKILLS];
      }
    } catch {
      this.skills = [...DEFAULT_SKILLS];
    }
  }

  private save() {
    const custom = this.skills.filter((s) => !s.isBuiltIn);
    fs.writeFileSync(this.dataPath, JSON.stringify(custom, null, 2), 'utf-8');
  }

  getAll(): Skill[] {
    return [...this.skills];
  }

  getEnabled(): Skill[] {
    return this.skills.filter((s) => s.enabled);
  }

  getById(id: string): Skill | undefined {
    return this.skills.find((s) => s.id === id);
  }

  toggleSkill(id: string, enabled: boolean): boolean {
    const s = this.skills.find((s) => s.id === id);
    if (!s) return false;
    s.enabled = enabled;
    this.save();
    return true;
  }

  addSkill(skill: Omit<Skill, 'id' | 'isBuiltIn' | 'createdAt'>): Skill {
    const newSkill: Skill = {
      ...skill,
      id: `skill-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      isBuiltIn: false,
      createdAt: new Date().toISOString(),
    };
    this.skills.push(newSkill);
    this.save();
    return newSkill;
  }

  updateSkill(id: string, updates: Partial<Omit<Skill, 'id' | 'isBuiltIn'>>): boolean {
    const s = this.skills.find((s) => s.id === id);
    if (!s) return false;
    Object.assign(s, updates);
    this.save();
    return true;
  }

  removeSkill(id: string): boolean {
    const idx = this.skills.findIndex((s) => s.id === id);
    if (idx === -1) return false;
    if (this.skills[idx].isBuiltIn) return false;
    this.skills.splice(idx, 1);
    this.save();
    return true;
  }
}

export const skillsManager = new SkillsManager();
