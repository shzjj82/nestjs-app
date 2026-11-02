/**
 * 对话消息 / 工具调用的类型，以及 JSON 抽取。
 * 诊所进程不要 new DeepSeekClient()：模型 HTTP 只在 agents 服务里。
 */
import { buildChatBody, detectLlmFamily, textFromMessage, textFromStreamData } from './llm-protocol';
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
  /** 仅 assistant 消息携带：模型发起的工具调用，回灌给下一轮对话。 */
  tool_calls?: ToolCallPayload[];
}

export interface JsonSchema {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface ChatTool {
  type: 'function';
  function: { name: string; description: string; parameters: JsonSchema };
}

export interface ToolCallPayload {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ChatResult {
  content: string;
  toolCalls: ToolCallPayload[];
  raw: Record<string, unknown>;
}

export interface DeepSeekOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  reasonerModel?: string;
  timeoutMs?: number;
}

export class DeepSeekClient {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly model: string;
  readonly reasonerModel: string;
  readonly timeoutMs: number;
  readonly family: ReturnType<typeof detectLlmFamily>;

  constructor(options: DeepSeekOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.LLM_API_KEY ?? process.env.QWEN_API_KEY ?? process.env.DEEPSEEK_API_KEY ?? '';
    this.baseUrl = (
      options.baseUrl ??
      process.env.LLM_BASE_URL ??
      process.env.QWEN_BASE_URL ??
      process.env.DEEPSEEK_BASE_URL ??
      'https://dashscope.aliyuncs.com/compatible-mode/v1'
    ).replace(/\/+$/, '');
    this.model = options.model ?? process.env.LLM_MODEL ?? process.env.QWEN_MODEL ?? process.env.DEEPSEEK_MODEL ?? 'qwen-plus';
    this.reasonerModel =
      options.reasonerModel ??
      process.env.LLM_REASONER_MODEL ??
      process.env.QWEN_REASONER_MODEL ??
      process.env.DEEPSEEK_REASONER_MODEL ??
      'qwen-max';
    this.timeoutMs = options.timeoutMs ?? Number(process.env.LLM_TIMEOUT ?? process.env.DEEPSEEK_TIMEOUT ?? 90000);
    this.family = detectLlmFamily(this.model, this.baseUrl);
  }

  get enabled(): boolean {
    return this.apiKey.length > 0;
  }

  status() {
    return {
      enabled: this.enabled,
      family: this.family,
      baseUrl: this.baseUrl,
      model: this.model,
      reasonerModel: this.reasonerModel,
    };
  }

  /** 文本对话。reasoner=true 时切换到推理模型（报告/教学文档/建议综合用）。 */
  async chat(messages: ChatMessage[], opts: { reasoner?: boolean; temperature?: number; maxTokens?: number } = {}): Promise<string> {
    const result = await this.completions(messages, { ...opts });
    return result.content;
  }

  /** 上游 SSE，按 token 产出正文。 */
  async *streamChat(
    messages: ChatMessage[],
    opts: { reasoner?: boolean; temperature?: number; maxTokens?: number } = {},
  ): AsyncGenerator<string> {
    if (!this.enabled) {
      throw new Error('未配置 LLM_API_KEY（或 QWEN_API_KEY），无法调用 AI 能力');
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const model = opts.reasoner ? this.reasonerModel : this.model;
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildChatBody({
          family: detectLlmFamily(model, this.baseUrl),
          model,
          messages,
          stream: true,
          reasoner: opts.reasoner,
          temperature: opts.temperature,
          maxTokens: opts.maxTokens,
        })),
        signal: controller.signal,
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(`LLM ${res.status}: ${detail.slice(0, 300)}`);
      }
      if (!res.body) throw new Error('LLM 未返回流');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const split = splitSseBlocks(buffer);
        buffer = split.rest;
        for (const data of split.events) {
          const delta = textFromStreamData(data);
          if (delta) yield delta;
        }
      }
    } finally {
      clearTimeout(timer);
    }
  }

  /** 要求模型输出 JSON 对象；失败时抛出（上层负责降级，不让脏数据入库）。 */
  async chatJson<T>(messages: ChatMessage[], opts: { reasoner?: boolean; temperature?: number; maxTokens?: number } = {}): Promise<T> {
    const text = await this.chat(messages, { ...opts, maxTokens: opts.maxTokens ?? 4000 });
    return extractJson<T>(text);
  }

  async completions(
    messages: ChatMessage[],
    opts: { reasoner?: boolean; temperature?: number; maxTokens?: number; tools?: ChatTool[] } = {},
  ): Promise<ChatResult> {
    if (!this.enabled) {
      throw new Error('未配置 LLM_API_KEY（或 QWEN_API_KEY），无法调用 AI 能力');
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const model = opts.reasoner ? this.reasonerModel : this.model;
      const body = buildChatBody({
        family: detectLlmFamily(model, this.baseUrl),
        model,
        messages,
        stream: false,
        reasoner: opts.reasoner,
        temperature: opts.temperature,
        maxTokens: opts.maxTokens,
        tools: opts.tools,
      });
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(`LLM ${res.status}: ${detail.slice(0, 300)}`);
      }
      const data = (await res.json()) as {
        choices?: Array<{ message?: Record<string, unknown> & { tool_calls?: ToolCallPayload[] } }>;
      };
      const message = data.choices?.[0]?.message ?? {};
      return {
        content: textFromMessage(message),
        toolCalls: message.tool_calls ?? [],
        raw: data as Record<string, unknown>,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

function splitSseBlocks(buffer: string): { events: string[]; rest: string } {
  const parts = buffer.split(/\r?\n\r?\n/);
  const rest = parts.pop() ?? '';
  const events: string[] = [];
  for (const block of parts) {
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith('data:')) events.push(line.slice(5).trimStart());
    }
  }
  return { events, rest };
}

/** 从可能被 ```json 包裹的输出里稳健抽取 JSON（对应 Python 侧 extract_json）。 */
export function extractJson<T>(text: string): T {
  if (!text) throw new Error('模型返回为空');
  const cleaned = text.replace(/^```(?:json)?/m, '').replace(/```$/m, '').trim();
  const candidates = [cleaned];
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) candidates.push(cleaned.slice(start, end + 1));
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as T;
    } catch {
      // 继续尝试下一个候选
    }
  }
  throw new Error(`模型未返回可解析的 JSON: ${text.slice(0, 200)}`);
}
