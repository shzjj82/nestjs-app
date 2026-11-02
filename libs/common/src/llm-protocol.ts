/**
 * 上游虽多走 OpenAI 兼容协议，各家模型的请求字段和流式增量并不一样。
 * 按模型族分流：通义思考模式、DeepSeek 推理、OpenAI o 系列。
 */

export type LlmFamily = 'qwen' | 'deepseek' | 'openai';

export function detectLlmFamily(model: string, baseUrl: string): LlmFamily {
  const hay = `${model} ${baseUrl}`.toLowerCase();
  if (hay.includes('qwen') || hay.includes('dashscope') || hay.includes('aliyuncs')) return 'qwen';
  if (hay.includes('deepseek')) return 'deepseek';
  return 'openai';
}

export function isReasoningModel(model: string): boolean {
  const name = model.toLowerCase();
  return /reasoner|thinking|qwq|-r1(?:-|$)|\bo1\b|\bo3\b/.test(name);
}

export function buildChatBody(input: {
  family: LlmFamily;
  model: string;
  messages: unknown;
  stream: boolean;
  reasoner?: boolean;
  temperature?: number;
  maxTokens?: number;
  tools?: unknown;
}): Record<string, unknown> {
  const reasoner = Boolean(input.reasoner || isReasoningModel(input.model));
  const body: Record<string, unknown> = {
    model: input.model,
    messages: input.messages,
    stream: input.stream,
  };

  if (input.family === 'qwen') {
    // Qwen3（qwen-plus / turbo / flash）默认开思考：增量走 reasoning_content，正文要等思考完。
    // 普通对话关掉思考才能逐字流出 content；推理调用才打开。
    if (/qwen3|qwen-plus|qwen-turbo|qwen-flash/i.test(input.model)) {
      body.enable_thinking = reasoner;
    }
    body.max_tokens = input.maxTokens ?? 4000;
    if (!reasoner) body.temperature = input.temperature ?? 0.3;
  } else if (input.family === 'deepseek') {
    body.max_tokens = input.maxTokens ?? 4000;
    if (!reasoner) body.temperature = input.temperature ?? 0.3;
  } else {
    const oSeries = /\bo1\b|\bo3\b/.test(input.model.toLowerCase());
    if (oSeries) {
      body.max_completion_tokens = input.maxTokens ?? 4000;
    } else {
      body.max_tokens = input.maxTokens ?? 4000;
      body.temperature = input.temperature ?? 0.3;
    }
  }

  if (input.tools && Array.isArray(input.tools) && input.tools.length) {
    body.tools = input.tools;
    body.tool_choice = 'auto';
  }
  return body;
}

/** 只取可见答复。思考过程（reasoning_content）不推给前端。 */
export function textFromStreamData(data: string): string {
  if (!data || data === '[DONE]') return '';
  try {
    const json = JSON.parse(data) as {
      choices?: Array<{ delta?: Record<string, unknown>; text?: string }>;
      output?: { text?: string };
    };
    const choice = json.choices?.[0];
    const fromDelta = textFromDelta(choice?.delta);
    if (fromDelta) return fromDelta;
    if (typeof choice?.text === 'string') return choice.text;
    if (typeof json.output?.text === 'string') return json.output.text;
    return '';
  } catch {
    return '';
  }
}

export function textFromDelta(delta?: Record<string, unknown>): string {
  if (!delta) return '';
  return stringifyContent(delta.content);
}

export function textFromMessage(message?: Record<string, unknown>): string {
  if (!message) return '';
  return stringifyContent(message.content).trim();
}

function stringifyContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part) return String((part as { text?: unknown }).text ?? '');
        return '';
      })
      .join('');
  }
  return '';
}
