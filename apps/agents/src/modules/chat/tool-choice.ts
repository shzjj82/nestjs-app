import { Injectable, Logger } from '@nestjs/common';
import { aiApiBase, aiApiKey, aiModel } from '../../ai/env';

export const LOOKUP_MATERIAL = 'lookup_material';
export const LIST_TODOS = 'list_todos';

export type ChatToolName = typeof LOOKUP_MATERIAL | typeof LIST_TODOS;

export type ChosenTool = {
  name: ChatToolName;
  query: string;
};

export type ChatToolSpec = {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: { query: { type: 'string'; description: string } };
    required: ['query'];
  };
};

const CHOICE_TIMEOUT_MS = 12_000;

const CHOICE_SYSTEM = `你只决定要调用哪些工具，不要回答用户。
lookup_material：用户在问概念、事实、流程、文档内容，或只给出一个主题名。
list_todos：用户在问自己的任务、安排或完成情况。
两件事都问到时，两个工具都调用。
只问自己的任务时，不要调用 lookup_material。
只问文档里怎么写待办时，不要调用 list_todos。
打招呼、改写、润色时不要调用任何工具。`;

const LOCAL_CHAT_TOOLS: ChatToolSpec[] = [
  {
    name: LOOKUP_MATERIAL,
    description:
      '查知识库和公开网页。用户在问概念、事实、流程、文档内容，或只给出一个主题名时调用。可以和 list_todos 一起调用。只问自己的任务时不要调用。打招呼、改写、润色不要调用。',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '用来检索的原话或更短的主题' },
      },
      required: ['query'],
    },
  },
  {
    name: LIST_TODOS,
    description:
      '读取当前用户自己的待办。用户在问自己的任务、安排或完成情况时调用。可以和 lookup_material 一起调用。只问文档里怎么写待办时不要调用。',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '用户原话' },
      },
      required: ['query'],
    },
  },
];

const KNOWN_TOOLS = new Set<string>(LOCAL_CHAT_TOOLS.map((tool) => tool.name));

/** 本地工具在前。以后把 MCP listTools 转成同样的形状后传进来。 */
export function chatToolSpecs(extra: ChatToolSpec[] = []): ChatToolSpec[] {
  return [...LOCAL_CHAT_TOOLS, ...extra];
}

export function chosenToolsFromMessage(message: unknown, fallbackQuery: string): ChosenTool[] {
  if (!message || typeof message !== 'object') {
    return [];
  }
  const calls = (message as { tool_calls?: unknown }).tool_calls;
  if (!Array.isArray(calls)) {
    return [];
  }
  const fallback = fallbackQuery.trim().slice(0, 2000);
  const picked: ChosenTool[] = [];
  const seen = new Set<string>();
  for (const call of calls) {
    if (!call || typeof call !== 'object') {
      return [];
    }
    const fn = (call as { function?: unknown }).function;
    if (!fn || typeof fn !== 'object') {
      return [];
    }
    const name = (fn as { name?: unknown }).name;
    const rawArgs = (fn as { arguments?: unknown }).arguments;
    if (typeof name !== 'string' || !KNOWN_TOOLS.has(name) || seen.has(name)) {
      continue;
    }
    let query = fallback;
    if (typeof rawArgs === 'string' && rawArgs.trim()) {
      try {
        const parsed = JSON.parse(rawArgs) as { query?: unknown };
        if (typeof parsed.query === 'string' && parsed.query.trim()) {
          query = parsed.query.trim().slice(0, 2000);
        }
      } catch {
        return [];
      }
    }
    seen.add(name);
    picked.push({ name: name as ChatToolName, query });
  }
  return picked;
}

export function chosenToolsFromCompletion(payload: unknown, fallbackQuery: string): ChosenTool[] {
  if (!payload || typeof payload !== 'object') {
    return [];
  }
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || !choices.length || !choices[0] || typeof choices[0] !== 'object') {
    return [];
  }
  return chosenToolsFromMessage(
    (choices[0] as { message?: unknown }).message,
    fallbackQuery,
  );
}

@Injectable()
export class ChatToolChooser {
  private readonly logger = new Logger('AgentsTools');

  async choose(query: string): Promise<ChosenTool[]> {
    const text = query.trim();
    const apiKey = aiApiKey();
    if (!text || !apiKey) {
      return [];
    }
    try {
      const res = await fetch(`${aiApiBase()}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: aiModel(),
          temperature: 0,
          max_tokens: 256,
          tool_choice: 'auto',
          tools: chatToolSpecs().map((spec) => ({
            type: 'function',
            function: {
              name: spec.name,
              description: spec.description,
              parameters: spec.parameters,
            },
          })),
          messages: [
            { role: 'system', content: CHOICE_SYSTEM },
            { role: 'user', content: text.slice(0, 2000) },
          ],
        }),
        signal: AbortSignal.timeout(CHOICE_TIMEOUT_MS),
      });
      if (!res.ok) {
        this.logger.warn(`tool choice upstream ${res.status}`);
        return [];
      }
      return chosenToolsFromCompletion(await res.json(), text);
    } catch (err) {
      this.logger.warn(
        `tool choice failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return [];
    }
  }
}
