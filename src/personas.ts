import fs from 'fs';
import path from 'path';
import { app } from 'electron';

// ============================================================
// 类型定义
// ============================================================

export interface AgentPersona {
  id: string;
  name: string;
  avatar: string;
  description: string;
  systemPrompt: string;
  isBuiltIn: boolean;
  createdAt: string;
}

// ============================================================
// 默认智能体预设
// ============================================================

const DEFAULT_PERSONAS: AgentPersona[] = [
  {
    id: 'assistant',
    name: '通用助手',
    avatar: '🤖',
    description: '一个强大的桌面 AI 助手，可以帮助完成各种任务',
    systemPrompt: `你是一个强大的桌面 AI 助手，名为 QAQ，运行在用户的 Windows 桌面上。你可以帮助用户完成各种任务。
当用户的问题需要使用工具时，请调用相应的工具来获取信息。
如果用户的问题可能与知识库内容相关，请优先使用 knowledge_search 工具检索相关信息。
请用中文回答用户的问题。回答要简洁、专业、有条理。`,
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'coder',
    name: '编程专家',
    avatar: '💻',
    description: '擅长代码编写、调试、架构设计的编程助手',
    systemPrompt: `你是一位资深编程专家，精通各种编程语言和技术栈。你擅长:
- 代码编写与优化
- Bug 诊断和修复
- 架构设计和技术选型
- 代码审查和最佳实践
请用代码块展示代码，给出清晰的解释。回答要专业、准确。`,
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'writer',
    name: '写作助手',
    avatar: '✍️',
    description: '擅长文章写作、文案策划、翻译润色的写作助手',
    systemPrompt: `你是一位优秀的写作助手，擅长:
- 文章写作与润色
- 文案策划与创意
- 中英文翻译
- 语法纠错和文风调整
请用优美流畅的中文回答。根据不同场景灵活调整写作风格。`,
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'analyst',
    name: '数据分析师',
    avatar: '📊',
    description: '擅长数据分析、图表解读、统计计算的分析专家',
    systemPrompt: `你是一位数据分析专家，擅长:
- 数据处理与分析
- 统计方法和趋势分析
- 数据可视化建议
- 商业洞察和报告撰写
请善用 calculator 工具进行精确计算。回答要有数据支撑，逻辑清晰。`,
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'translator',
    name: '翻译官',
    avatar: '🌐',
    description: '精通多语言的翻译专家，提供专业翻译服务',
    systemPrompt: `你是一位精通多语言的专业翻译官。你的主要职责是:
- 提供准确的中英文翻译
- 根据上下文调整翻译用语
- 解释语言差异和文化背景
- 提供翻译的多种可选方案
请始终保持翻译的专业性和准确性，同时注重自然流畅的表达。`,
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
  },
];

// ============================================================
// 角色管理器
// ============================================================

class PersonaManager {
  private personas: AgentPersona[] = [];
  private activeId: string = 'assistant';
  private dataPath: string;
  private activePath: string;

  constructor() {
    const dir = path.join(app.getPath('userData'), 'personas');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    this.dataPath = path.join(dir, 'personas.json');
    this.activePath = path.join(dir, 'active.json');
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(this.dataPath)) {
        const saved = JSON.parse(fs.readFileSync(this.dataPath, 'utf-8')) as AgentPersona[];
        // 合并默认 + 自定义
        this.personas = [...DEFAULT_PERSONAS];
        for (const s of saved) {
          if (!s.isBuiltIn) this.personas.push(s);
        }
      } else {
        this.personas = [...DEFAULT_PERSONAS];
      }
      if (fs.existsSync(this.activePath)) {
        this.activeId = JSON.parse(fs.readFileSync(this.activePath, 'utf-8'));
      }
    } catch {
      this.personas = [...DEFAULT_PERSONAS];
    }
  }

  private save() {
    const custom = this.personas.filter((p) => !p.isBuiltIn);
    fs.writeFileSync(this.dataPath, JSON.stringify(custom, null, 2), 'utf-8');
    fs.writeFileSync(this.activePath, JSON.stringify(this.activeId), 'utf-8');
  }

  getAll(): AgentPersona[] {
    return [...this.personas];
  }

  getActive(): AgentPersona {
    return this.personas.find((p) => p.id === this.activeId) || this.personas[0];
  }

  setActive(id: string): boolean {
    const p = this.personas.find((p) => p.id === id);
    if (!p) return false;
    this.activeId = id;
    this.save();
    return true;
  }

  addCustom(persona: Omit<AgentPersona, 'id' | 'isBuiltIn' | 'createdAt'>): AgentPersona {
    const newPersona: AgentPersona = {
      ...persona,
      id: `persona-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      isBuiltIn: false,
      createdAt: new Date().toISOString(),
    };
    this.personas.push(newPersona);
    this.save();
    return newPersona;
  }

  updatePersona(id: string, updates: Partial<Omit<AgentPersona, 'id' | 'isBuiltIn'>>): boolean {
    const p = this.personas.find((p) => p.id === id);
    if (!p) return false;
    Object.assign(p, updates);
    this.save();
    return true;
  }

  removePersona(id: string): boolean {
    const idx = this.personas.findIndex((p) => p.id === id);
    if (idx === -1) return false;
    if (this.personas[idx].isBuiltIn) return false; // 不能删内置
    this.personas.splice(idx, 1);
    if (this.activeId === id) this.activeId = this.personas[0].id;
    this.save();
    return true;
  }
}

export const personaManager = new PersonaManager();
