import {
  type BaseMessage,
  HumanMessage,
  SystemMessage,
  AIMessage,
} from '@langchain/core/messages';
import { tool } from '@langchain/core/tools';
import { ChatOpenAI } from '@langchain/openai';
import { ChatOllama } from '@langchain/ollama';
import { StateGraph, Annotation, END } from '@langchain/langgraph';
import { z } from 'zod';
import { knowledgeBase } from './knowledge.js';
import { personaManager } from './personas.js';
import { skillsManager, type Skill } from './skills-manager.js';

// ============================================================
// 类型定义
// ============================================================

export interface AgentSettings {
  provider: 'openai' | 'ollama';
  apiKey: string;
  model: string;
  baseUrl: string;
  temperature: number;
  maxContextMessages: number;
}

export interface ToolEvent {
  type: 'tool_start' | 'tool_end';
  toolName: string;
  input?: string;
  output?: string;
}

export interface ChatAttachment {
  type: 'image' | 'file';
  name: string;
  dataUrl: string;
  mimeType?: string;
}

interface AgentResult {
  response: string;
  toolCalls: Array<{ name: string; args: Record<string, any> }>;
}

// ============================================================
// 工具定义
// ============================================================

const calculatorTool = tool(
  async ({ expression }) => {
    try {
      const sanitized = expression.replace(/[^0-9+\-*/().%\s]/g, '');
      if (sanitized !== expression) return '错误: 表达式包含不允许的字符';
      const result = new Function(`return (${sanitized})`)();
      return `计算结果: ${expression} = ${result}`;
    } catch (e: any) {
      return `计算错误: ${e.message}`;
    }
  },
  {
    name: 'calculator',
    description: '执行数学计算。输入一个数学表达式',
    schema: z.object({ expression: z.string().describe('要计算的数学表达式') }),
  }
);

const dateTimeTool = tool(
  async ({}) => {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
      timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit',
      day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'long',
    };
    return `当前时间 (Asia/Shanghai): ${now.toLocaleString('zh-CN', options)}`;
  },
  {
    name: 'get_datetime',
    description: '获取当前日期和时间信息',
    schema: z.object({ query: z.string().describe('时间查询').default('') }),
  }
);

const textAnalysisTool = tool(
  async ({ text }) => {
    const charCount = text.length;
    const wordCount = text.trim().split(/\s+/).length;
    const chineseCharCount = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const lineCount = text.split('\n').length;
    const upperCaseCount = (text.match(/[A-Z]/g) || []).length;
    const lowerCaseCount = (text.match(/[a-z]/g) || []).length;
    const numberCount = (text.match(/[0-9]/g) || []).length;
    return [
      `文本分析结果:`,
      `- 总字符数: ${charCount}`, `- 单词数: ${wordCount}`, `- 中文字符数: ${chineseCharCount}`,
      `- 行数: ${lineCount}`, `- 大写字母: ${upperCaseCount}`, `- 小写字母: ${lowerCaseCount}`,
      `- 数字: ${numberCount}`,
    ].join('\n');
  },
  {
    name: 'text_analysis',
    description: '分析文本的统计信息，包括字符数、单词数、行数等',
    schema: z.object({ text: z.string().describe('要分析的文本内容') }),
  }
);

const randomTool = tool(
  async ({ min, max }) => {
    return `随机数 (${min} ~ ${max}): ${Math.floor(Math.random() * (max - min + 1)) + min}`;
  },
  {
    name: 'random_number',
    description: '生成一个指定范围内的随机整数',
    schema: z.object({ min: z.number().describe('最小值'), max: z.number().describe('最大值') }),
  }
);

// 知识库搜索工具 - 动态创建
function createKnowledgeSearchTool(settings: AgentSettings) {
  return tool(
    async ({ query }) => {
      const stats = knowledgeBase.getStats();
      if (stats.chunkCount === 0) return '知识库为空，请先在知识库管理中添加文档。';
      const results = await knowledgeBase.search(query, settings, 5);
      if (results.length === 0) return '未在知识库中找到相关信息。';
      return results
        .map((r, i) =>
          `[${i + 1}] 来源: ${r.docName} (相似度: ${(r.score * 100).toFixed(1)}%)\n${r.content}`
        )
        .join('\n\n---\n\n');
    },
    {
      name: 'knowledge_search',
      description: '搜索知识库中的相关文档和信息。当用户的问题可能涉及知识库内容时使用此工具',
      schema: z.object({ query: z.string().describe('搜索查询语句') }),
    }
  );
}

// 为每个技能动态创建 LangChain tool
function createSkillTools(enabledSkills: Skill[]) {
  return enabledSkills.map((skill) => {
    const schemaObj: Record<string, any> = {};
    for (const param of skill.parameters) {
      let zodType: z.ZodType;
      if (param.type === 'number') zodType = z.number().describe(param.description);
      else if (param.type === 'boolean') zodType = z.boolean().describe(param.description);
      else zodType = z.string().describe(param.description);
      if (!param.required) zodType = zodType.optional();
      schemaObj[param.name] = zodType;
    }
    return tool(
      async (args) => {
        // 技能工具返回参数 + prompt 给 Agent 处理
        const paramStr = Object.entries(args).map(([k, v]) => `${k}: ${v}`).join('\n');
        return `[技能: ${skill.name}]\n${skill.prompt}\n\n用户提供的参数:\n${paramStr}`;
      },
      {
        name: `skill_${skill.id.replace(/[^a-zA-Z0-9]/g, '_')}`,
        description: `${skill.icon} ${skill.name}: ${skill.description}`,
        schema: z.object(schemaObj),
      }
    );
  });
}

// ============================================================
// 多模态消息构建
// ============================================================

function buildHumanMessage(
  text: string,
  attachments?: ChatAttachment[]
): HumanMessage {
  if (!attachments || attachments.length === 0) {
    return new HumanMessage(text);
  }

  const contentParts: any[] = [];

  // 处理文件附件 -> 文本内容
  const fileAttachments = attachments.filter((a) => a.type === 'file');
  if (fileAttachments.length > 0) {
    const fileContent = fileAttachments
      .map((a) => `[文件: ${a.name}]\n${a.dataUrl}`)
      .join('\n\n');
    contentParts.push({ type: 'text', text: `${text}\n\n---附件内容---\n${fileContent}` });
  } else {
    contentParts.push({ type: 'text', text });
  }

  // 处理图片附件
  const imageAttachments = attachments.filter((a) => a.type === 'image');
  for (const img of imageAttachments) {
    contentParts.push({
      type: 'image_url',
      image_url: { url: img.dataUrl },
    });
  }

  return new HumanMessage({ content: contentParts });
}

// ============================================================
// LangGraph Agent 图定义
// ============================================================

const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (prev: BaseMessage[], next: BaseMessage[]) => [...prev, ...next],
    default: () => [],
  }),
});

function createModel(settings: AgentSettings) {
  if (settings.provider === 'ollama') {
    return new ChatOllama({
      model: settings.model || 'llama3.1',
      baseUrl: settings.baseUrl || 'http://localhost:11434',
      temperature: settings.temperature,
    });
  }
  const config: any = {
    model: settings.model || 'gpt-4o-mini',
    temperature: settings.temperature,
    apiKey: settings.apiKey || process.env.OPENAI_API_KEY,
  };
  if (settings.baseUrl) {
    config.configuration = { baseURL: settings.baseUrl };
  }
  return new ChatOpenAI(config);
}

export function buildAgentGraph(
  settings: AgentSettings,
  onToolEvent?: (event: ToolEvent) => void
) {
  const enabledSkills = skillsManager.getEnabled();
  const allTools = [
    calculatorTool,
    dateTimeTool,
    textAnalysisTool,
    randomTool,
    createKnowledgeSearchTool(settings),
    ...createSkillTools(enabledSkills),
  ];

  const llm = createModel(settings).bindTools(allTools);

  async function agentNode(state: typeof AgentState.State): Promise<Partial<typeof AgentState.State>> {
    const response = await llm.invoke(state.messages);
    return { messages: [response] };
  }

  async function toolsNode(state: typeof AgentState.State): Promise<Partial<typeof AgentState.State>> {
    const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
    const toolCalls = lastMessage.tool_calls || [];
    const results: BaseMessage[] = [];

    for (const call of toolCalls) {
      const toolArgs = call.args as Record<string, any>;
      const foundTool = allTools.find((t) => t.name === call.name);

      onToolEvent?.({ type: 'tool_start', toolName: call.name, input: JSON.stringify(toolArgs, null, 2) });

      if (foundTool) {
        try {
          const output = await (foundTool as any).invoke(toolArgs);
          const content = typeof output === 'string' ? output : JSON.stringify(output);
          onToolEvent?.({ type: 'tool_end', toolName: call.name, output: content });
          results.push({ role: 'tool', content, tool_call_id: call.id } as any);
        } catch (e: any) {
          const errorMsg = `工具执行错误: ${e.message}`;
          onToolEvent?.({ type: 'tool_end', toolName: call.name, output: errorMsg });
          results.push({ role: 'tool', content: errorMsg, tool_call_id: call.id } as any);
        }
      }
    }
    return { messages: results };
  }

  function shouldContinue(state: typeof AgentState.State): 'tools' | 'end' {
    const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
    if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) return 'tools';
    return 'end';
  }

  const graph = new StateGraph(AgentState)
    .addNode('agent', agentNode)
    .addNode('tools', toolsNode)
    .addEdge('__start__', 'agent')
    .addConditionalEdges('agent', shouldContinue, { tools: 'tools', end: END })
    .addEdge('tools', 'agent')
    .compile();

  return graph;
}

// ============================================================
// 上下文裁剪
// ============================================================

function trimContext(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  maxMessages: number
): Array<{ role: 'user' | 'assistant'; content: string }> {
  if (!maxMessages || maxMessages <= 0) return messages;
  // 保留最近的 maxMessages 条对话 (user + assistant 各算一条)
  // 每轮对话 = 2条消息
  const maxSlots = maxMessages * 2;
  if (messages.length <= maxSlots) return messages;
  return messages.slice(-maxSlots);
}

// ============================================================
// 执行 Agent
// ============================================================

export async function runAgent(
  message: string,
  settings: AgentSettings,
  onToolEvent?: (event: ToolEvent) => void,
  attachments?: ChatAttachment[],
  chatHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<AgentResult> {
  const graph = buildAgentGraph(settings, onToolEvent);

  // 获取当前角色
  const persona = personaManager.getActive();

  // 构建系统提示
  let systemPrompt = persona.systemPrompt;

  // 注入已启用的技能描述到系统提示
  const enabledSkills = skillsManager.getEnabled();
  if (enabledSkills.length > 0) {
    const skillsDesc = enabledSkills
      .map((s) => `- ${s.icon} ${s.name}: ${s.description}`)
      .join('\n');
    systemPrompt += `\n\n你可以使用以下技能:\n${skillsDesc}`;
  }

  systemPrompt += `\n\n你可以使用以下工具:
- calculator: 执行数学计算
- get_datetime: 获取当前日期和时间
- text_analysis: 分析文本统计信息
- random_number: 生成随机数
- knowledge_search: 搜索知识库中的相关文档和信息`;

  // 构建消息列表
  const llmMessages: BaseMessage[] = [new SystemMessage(systemPrompt)];

  // 添加历史消息 (带上下文裁剪)
  if (chatHistory && chatHistory.length > 0) {
    const trimmed = trimContext(chatHistory, settings.maxContextMessages || 20);
    for (const msg of trimmed) {
      if (msg.role === 'user') {
        llmMessages.push(new HumanMessage(msg.content));
      } else {
        llmMessages.push(new AIMessage(msg.content));
      }
    }
  }

  // 添加当前消息 (支持多模态)
  llmMessages.push(buildHumanMessage(message, attachments));

  const result = await graph.invoke({ messages: llmMessages });

  const allMessages = result.messages as BaseMessage[];
  const lastAiMessage = allMessages.filter(
    (m) => m.constructor.name === 'AIMessage' || (m as any)._getType?.() === 'ai'
  ).pop() as AIMessage | undefined;

  const response = lastAiMessage?.content?.toString() || '抱歉，我暂时无法回答这个问题。';

  const toolCalls = allMessages
    .filter((m) => (m as AIMessage).tool_calls && (m as AIMessage).tool_calls!.length > 0)
    .flatMap((m) =>
      (m as AIMessage).tool_calls!.map((tc) => ({
        name: tc.name,
        args: tc.args as Record<string, any>,
      }))
    );

  return { response, toolCalls };
}
