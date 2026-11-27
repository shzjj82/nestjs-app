import type { AgentChatAttachment, AgentChatRole } from '@app/common';
import type { ChatTodo } from '../rag/rag-port';
import { PROMPT_CODES, type PromptCode } from '../prompts/codes';

/**
 * 余弦相似度达到这条线，才把片段当作知识库正文。
 * 低于此线的标题或待办名命中不交给模型，避免被当成资料。
 */
export const RAG_HIT_SCORE = 0.5;

export type ChatIntent = 'chat' | 'knowledge' | 'todo';

const DOCUMENT_CUE = /这篇|这个文档|这篇文章|文档里|页面里|知识库|资料里|根据资料|文中/;
const TODO_CUE =
  /我的待办|我的任务|我的安排|待办列表|待办事项|未完成的?(?:任务|待办)|已完成的?(?:任务|待办)|进行中的?(?:任务|待办)|全部任务|所有任务|所有待办|(?:今天|明天|这周|本周).{0,8}(?:要做|做什么|的任务|的待办|的安排)|(?:有哪些|有什么|还有什么|还有哪些).{0,8}(?:任务|待办)|截止|到期/;
const CHAT_CUE = /^(?:你好|嗨|在吗|谢谢|早上好|晚上好)|帮我(?:写|改|润色|翻译|续写)|改写|润色/;
const KNOWLEDGE_CUE =
  /什么是|是什么|怎么|如何|为什么|为何|定义|区别|对比|详解|包含哪些|资料|文档|知识库|网上|网络上|互联网|业界/;

/**
 * 闲聊只写作。问资料走知识库，并且可以联网。问自己的任务走待办列表。
 * 点名某篇文档时仍走资料，页面上的待办已经在知识库里。
 */
export function classifyChatIntent(query: string): ChatIntent {
  const text = query.trim();
  if (!text) {
    return 'chat';
  }
  if (DOCUMENT_CUE.test(text)) {
    return 'knowledge';
  }
  if (TODO_CUE.test(text)) {
    return 'todo';
  }
  if (CHAT_CUE.test(text)) {
    return 'chat';
  }
  if (KNOWLEDGE_CUE.test(text) || asksForOutsideDefinition(text)) {
    return 'knowledge';
  }
  if (/待办/.test(text)) {
    return 'todo';
  }
  return 'chat';
}

/** 已完成、全部、未完成用不同状态；默认只取还没做完的。 */
export function todoStatusFilter(query: string): string {
  if (/已完成|做完/.test(query)) {
    return 'done';
  }
  if (/全部任务|所有待办|所有任务/.test(query)) {
    return 'pending,in_progress,done';
  }
  return 'pending,in_progress';
}

/** 用户点名要资料以外的定义，而不是在问知识库里怎么写。 */
export function asksForOutsideDefinition(query: string): boolean {
  return /网上|网络上|互联网|业界|社区说法|通用定义|通常怎么定义|一般怎么定义|通常的定义|一般的定义/.test(
    query,
  );
}

export type WebHit = { title: string; url: string; content: string };

export function todoListAppendix(items: ChatTodo[], available: boolean): string {
  if (!available) {
    return '【我的待办】\n待办列表暂时没有取到。不要编造任务。';
  }
  if (!items.length) {
    return '【我的待办】\n没有符合条件的待办。';
  }
  const lines = ['【我的待办】'];
  for (const item of items) {
    const title = item.title.trim();
    if (!title) {
      continue;
    }
    const range = item.dueAt ? `，截止 ${item.dueAt.slice(0, 10)}` : '';
    lines.push(`- ${todoStatusLabel(item.status)}：${title}${range}`);
    const detail = item.content.trim();
    if (detail) {
      lines.push(detail);
    }
  }
  return lines.join('\n');
}

function todoStatusLabel(status: string): string {
  switch (status) {
    case 'in_progress':
      return '进行中';
    case 'done':
      return '已完成';
    case 'cancelled':
      return '已终止';
    default:
      return '未开始';
  }
}

export function webResultsAppendix(hits: WebHit[]): string {
  if (!hits.length) {
    return '';
  }
  const blocks = hits.map((item, index) => {
    const body = item.content ? `\n${item.content}` : '';
    const title = item.title.replace(/[\[\]]/g, '').trim() || item.url;
    return `### [${index + 1}] [${title}](${item.url})${body}`;
  });
  return `【网上结果】\n${blocks.join('\n\n')}`;
}

type RagHit = {
  title: string;
  slug: string;
  content: string;
  sourceType: string;
  score: number;
  sourceName?: string;
};

/** 给模型和界面看的来源类型，不用 editorjs 这类存储名。 */
export function sourceKindLabel(sourceType: string): string {
  switch (sourceType) {
    case 'editorjs':
      return '页面正文';
    case 'image':
      return '图片';
    case 'todo':
      return '待办';
    case 'doc':
    case 'docx':
      return 'Word';
    case 'xls':
    case 'xlsx':
    case 'csv':
      return 'Excel';
    case 'pdf':
      return 'PDF';
    case 'txt':
      return '文本';
    default:
      return '文件';
  }
}

/** 出处该跳到页面，还是文件、图片。 */
export function sourcePlace(item: { title: string; sourceType: string; sourceName?: string }): string {
  if (item.sourceType === 'editorjs') {
    return item.title ? `页面「${item.title}」` : '页面';
  }
  if (item.sourceType === 'image') {
    return '图片';
  }
  if (item.sourceType === 'todo') {
    return '待办';
  }
  const name = item.sourceName?.trim();
  return name ? `文件「${name}」` : '文件';
}

export type RagPolicy<T extends RagHit> = {
  /** grounded：分数够，只准用资料。general：分数不够，允许标明后的通用知识。 */
  mode: 'grounded' | 'general';
  sources: T[];
  promptCode: PromptCode;
  context: string;
};

/** 按命中分决定回答方式。未达标的片段不进入参考资料。 */
export function applyRagPolicy<T extends RagHit>(sources: T[], query = ''): RagPolicy<T> {
  const grounded = sources
    .filter((item) => Number(item.score) >= RAG_HIT_SCORE)
    .sort((a, b) => b.score - a.score);
  if (grounded.length > 0) {
    return {
      mode: 'grounded',
      sources: grounded,
      promptCode: asksForOutsideDefinition(query)
        ? PROMPT_CODES.chatRagGroundedOutside
        : PROMPT_CODES.chatRagGrounded,
      context: ragContextAppendix(grounded),
    };
  }
  return {
    mode: 'general',
    sources: [],
    promptCode: PROMPT_CODES.chatRagGeneral,
    context: '',
  };
}

export type ChatContent =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export type UpstreamMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string | ChatContent[];
};

export type NormalizedMessage = { role: AgentChatRole; content: string };

export function normalizeMessages(messages: unknown[]): NormalizedMessage[] {
  return messages
    .filter(
      (item): item is { role: AgentChatRole; content: unknown } =>
        Boolean(item) &&
        typeof item === 'object' &&
        ((item as { role?: unknown }).role === 'user' ||
          (item as { role?: unknown }).role === 'assistant'),
    )
    .map((item) => ({
      role: item.role,
      content: String(item.content ?? '')
        .trim()
        .slice(0, 8000),
    }))
    .filter((item) => item.content)
    .slice(-24);
}

export function describeAttachments(attachments: AgentChatAttachment[]): {
  imageUrls: string[];
  textParts: string[];
} {
  const imageUrls = attachments
    .filter((item): item is Extract<AgentChatAttachment, { kind: 'image' }> => item.kind === 'image')
    .map((item) => item.url.trim())
    .filter(Boolean);
  const textParts = attachments
    .filter((item): item is Extract<AgentChatAttachment, { kind: 'text' }> => item.kind === 'text')
    .map((item) => `【附件文本：${item.name}】\n${item.text.slice(0, 12000)}`);
  return { imageUrls, textParts };
}

export function contextAppendix(attachments: AgentChatAttachment[]): string {
  const { imageUrls, textParts } = describeAttachments(attachments);
  return [
    imageUrls.length ? `可用图片 URL：\n${imageUrls.join('\n')}` : '',
    textParts.length ? textParts.join('\n\n') : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function ragContextAppendix(
  sources: Array<{
    title: string;
    slug: string;
    content: string;
    sourceType: string;
    sourceName?: string;
  }>,
): string {
  if (!sources.length) {
    return '';
  }
  const blocks = sources.map((item, index) => {
    const label = item.title || item.slug || `文档${index + 1}`;
    return `### [${index + 1}] ${label}\n类型：${sourceKindLabel(item.sourceType)}\n定位：${sourcePlace(item)}\n${item.content}`;
  });
  return `【参考资料】\n${blocks.join('\n\n')}`;
}

export function buildHistoryMessages(
  system: string,
  messages: NormalizedMessage[],
  appendix: string,
  imageUrls: string[],
  multimodal: boolean,
): UpstreamMessage[] {
  const history = messages.map((item, index) => {
    const isLastUser = index === messages.length - 1 && item.role === 'user';
    if (!isLastUser) {
      return { role: item.role, content: item.content } satisfies UpstreamMessage;
    }
    const text = appendix ? `${item.content}\n\n——\n${appendix}` : item.content;
    if (multimodal && imageUrls.length) {
      const content: ChatContent[] = [{ type: 'text', text }];
      for (const url of imageUrls.slice(0, 6)) {
        content.push({ type: 'image_url', image_url: { url } });
      }
      return { role: 'user' as const, content };
    }
    return { role: 'user' as const, content: text };
  });
  return [{ role: 'system', content: system }, ...history];
}
