import type { AgentChatAttachment, AgentChatRole } from '@app/common';

export const DEFAULT_SYSTEM = `你是中文写作搭档。
用自然中文和用户聊天，一起想题目、结构、段落、语气。
可以给大纲、草稿片段、修改建议；回复可用 Markdown（标题、列表、加粗、代码块等）方便阅读。
语气轻松、克制，像朋友一起写，不要广告腔。
如果用户上传了图片或文本附件，请结合它们讨论。
如果用户消息里带有「划选原文」，请紧扣那段文字回答（改写、扩写、纠错、解释等）。
若提供了「参考资料」，请优先依据资料回答，并在相关处简要标明来自哪篇文档；资料不足时再说明无法从资料确认。`;

/**
 * 余弦相似度达到这条线，才把片段当作知识库正文。
 * 低于此线的标题或待办名命中不交给模型，避免被当成资料。
 */
export const RAG_HIT_SCORE = 0.5;

export const RAG_GROUNDED_SYSTEM = `本次知识库检索已命中。只根据下方参考资料回答，并标明文档标题。不要用通用知识补充资料里没有的细节。待办、日期、负责人和项目事实若资料未列出，直接说没有，不要编造。`;

export const RAG_GENERAL_SYSTEM = `本次知识库检索未达到采用线，没有可引用的正文。不要把未附上的页面当成依据，也不要编造文档标题。先说明知识库里没有可回答该问题的正文，再另起一段用通用知识回答，并标明「以下不是知识库内容」。待办、日期、负责人和项目里有没有这件事，仍然只能说资料不足，不要用通用知识编造。`;

type RagHit = { title: string; slug: string; content: string; sourceType: string; score: number };

export type RagPolicy<T extends RagHit> = {
  /** grounded：分数够，只准用资料。general：分数不够，允许标明后的通用知识。 */
  mode: 'grounded' | 'general';
  sources: T[];
  systemAppendix: string;
  context: string;
};

/** 按命中分决定回答方式。未达标的片段不进入参考资料。 */
export function applyRagPolicy<T extends RagHit>(sources: T[]): RagPolicy<T> {
  const grounded = sources
    .filter((item) => Number(item.score) >= RAG_HIT_SCORE)
    .sort((a, b) => b.score - a.score);
  if (grounded.length > 0) {
    return {
      mode: 'grounded',
      sources: grounded,
      systemAppendix: RAG_GROUNDED_SYSTEM,
      context: ragContextAppendix(grounded),
    };
  }
  return {
    mode: 'general',
    sources: [],
    systemAppendix: RAG_GENERAL_SYSTEM,
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
  sources: Array<{ title: string; slug: string; content: string; sourceType: string }>,
): string {
  if (!sources.length) {
    return '';
  }
  const blocks = sources.map((item, index) => {
    const label = item.title || item.slug || `文档${index + 1}`;
    return `### [${index + 1}] ${label}（${item.sourceType}）\n${item.content}`;
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
