import {
  type BaseMessage,
  HumanMessage,
  SystemMessage,
  AIMessage,
} from '@langchain/core/messages';
import {
  type RunnableConfig,
} from '@langchain/core/runnables';
import { tool } from '@langchain/core/tools';
import { ChatOpenAI } from '@langchain/openai';
import { ChatOllama } from '@langchain/ollama';
import { StateGraph, Annotation, END } from '@langchain/langgraph';
import { z } from 'zod';

// ============================================================
// 类型定义
// ============================================================
export interface AgentSettings {
  provider: 'openai' | 'ollama';
  apiKey: string;
  model: string;
  baseUrl: string;
  temperature: number;
}

export interface ToolEvent {
  type: 'tool_start' | 'tool_end';
  toolName: string;
  input?: string;
  output?: string;
}

interface AgentResult {
  response: string;
  toolCalls: Array<{ name: string; args: Record<string, any> }>;
}

// ============================================================
// 工具定义 (使用 LangChain tool() 辅助函数)
// ============================================================

const calculatorTool = tool(
  async ({ expression }) => {
    try {
      // 安全的数学表达式求值
      const sanitized = expression.replace(/[^0-9+\-*/().%\s]/g, '');
      if (sanitized !== expression) {
        return '错误: 表达式包含不允许的字符';
      }
      // 使用 Function 构造器进行求值
      const result = new Function(`return (${sanitized})`)();
      return `计算结果: ${expression} = ${result}`;
    } catch (e: any) {
      return `计算错误: ${e.message}`;
    }
  },
  {
    name: 'calculator',
    description: '执行数学计算。输入一个数学表达式，例如 "2 + 3 * 4" 或 "(100 - 20) / 4"',
    schema: z.object({
      expression: z.string().describe('要计算的数学表达式'),
    }),
  }
);

const dateTimeTool = tool(
  async ({ query }) => {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'long',
    };
    const formatted = now.toLocaleString('zh-CN', options);
    return `当前时间 (Asia/Shanghai): ${formatted}`;
  },
  {
    name: 'get_datetime',
    description: '获取当前日期和时间信息',
    schema: z.object({
      query: z.string().describe('时间查询，可以留空').default(''),
    }),
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
      `- 总字符数: ${charCount}`,
      `- 单词数: ${wordCount}`,
      `- 中文字符数: ${chineseCharCount}`,
      `- 行数: ${lineCount}`,
      `- 大写字母: ${upperCaseCount}`,
      `- 小写字母: ${lowerCaseCount}`,
      `- 数字: ${numberCount}`,
    ].join('\n');
  },
  {
    name: 'text_analysis',
    description: '分析文本的统计信息，包括字符数、单词数、行数等',
    schema: z.object({
      text: z.string().describe('要分析的文本内容'),
    }),
  }
);

const randomTool = tool(
  async ({ min, max }) => {
    const result = Math.floor(Math.random() * (max - min + 1)) + min;
    return `随机数 (${min} ~ ${max}): ${result}`;
  },
  {
    name: 'random_number',
    description: '生成一个指定范围内的随机整数',
    schema: z.object({
      min: z.number().describe('最小值'),
      max: z.number().describe('最大值'),
    }),
  }
);

const ALL_TOOLS = [calculatorTool, dateTimeTool, textAnalysisTool, randomTool];

// ============================================================
// LangGraph Agent 图定义
// ============================================================

// 定义 Agent 状态
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
  const llm = createModel(settings).bindTools(ALL_TOOLS);

  // --- 节点函数 ---
  async function agentNode(
    state: typeof AgentState.State
  ): Promise<Partial<typeof AgentState.State>> {
    const response = await llm.invoke(state.messages);
    return { messages: [response] };
  }

  async function toolsNode(
    state: typeof AgentState.State
  ): Promise<Partial<typeof AgentState.State>> {
    const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
    const toolCalls = lastMessage.tool_calls || [];
    const results: BaseMessage[] = [];

    for (const call of toolCalls) {
      const toolName = call.name;
      const toolArgs = call.args as Record<string, any>;
      const foundTool = ALL_TOOLS.find((t) => t.name === toolName);

      onToolEvent?.({
        type: 'tool_start',
        toolName,
        input: JSON.stringify(toolArgs, null, 2),
      });

      if (foundTool) {
        try {
          const output = await foundTool.invoke({
            ...toolArgs,
          });
          const content = typeof output === 'string' ? output : JSON.stringify(output);

          onToolEvent?.({
            type: 'tool_end',
            toolName,
            output: content,
          });

          results.push({
            role: 'tool',
            content,
            tool_call_id: call.id,
          } as any);
        } catch (e: any) {
          const errorMsg = `工具执行错误: ${e.message}`;
          onToolEvent?.({
            type: 'tool_end',
            toolName,
            output: errorMsg,
          });
          results.push({
            role: 'tool',
            content: errorMsg,
            tool_call_id: call.id,
          } as any);
        }
      }
    }

    return { messages: results };
  }

  // --- 条件路由 ---
  function shouldContinue(state: typeof AgentState.State): 'tools' | 'end' {
    const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
    if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
      return 'tools';
    }
    return 'end';
  }

  // --- 构建图 ---
  const graph = new StateGraph(AgentState)
    .addNode('agent', agentNode)
    .addNode('tools', toolsNode)
    .addEdge('__start__', 'agent')
    .addConditionalEdges('agent', shouldContinue, {
      tools: 'tools',
      end: END,
    })
    .addEdge('tools', 'agent')
    .compile();

  return graph;
}

// ============================================================
// 执行 Agent
// ============================================================

const SYSTEM_PROMPT = `你是一个强大的桌面 AI 助手，运行在用户的 Windows 桌面上。你可以帮助用户完成各种任务。

你可以使用以下工具:
- calculator: 执行数学计算
- get_datetime: 获取当前日期和时间
- text_analysis: 分析文本统计信息
- random_number: 生成随机数

当用户的问题需要使用工具时，请调用相应的工具来获取信息。
请用中文回答用户的问题。回答要简洁、专业、有条理。`;

export async function runAgent(
  message: string,
  settings: AgentSettings,
  onToolEvent?: (event: ToolEvent) => void
): Promise<AgentResult> {
  const graph = buildAgentGraph(settings, onToolEvent);

  const messages: BaseMessage[] = [
    new SystemMessage(SYSTEM_PROMPT),
    new HumanMessage(message),
  ];

  const result = await graph.invoke({ messages });

  const allMessages = result.messages as BaseMessage[];
  const lastAiMessage = allMessages.filter(
    (m) => m.constructor.name === 'AIMessage' || (m as any)._getType?.() === 'ai'
  ).pop() as AIMessage | undefined;

  const response =
    lastAiMessage?.content?.toString() || '抱歉，我暂时无法回答这个问题。';

  // 收集所有工具调用
  const toolCalls = allMessages
    .filter(
      (m) =>
        (m as AIMessage).tool_calls && (m as AIMessage).tool_calls.length > 0
    )
    .flatMap((m) =>
      (m as AIMessage).tool_calls.map((tc) => ({
        name: tc.name,
        args: tc.args as Record<string, any>,
      }))
    );

  return { response, toolCalls };
}
