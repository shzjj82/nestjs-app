import type { AgentChatAttachment, AgentChatRole } from '@app/common';

export const DEFAULT_SYSTEM = `你是中文写作搭档。
用自然中文和用户聊天，一起想题目、结构、段落、语气。
可以给大纲、草稿片段、修改建议；回复可用 Markdown（标题、列表、加粗、代码块等）方便阅读。
语气轻松、克制，像朋友一起写，不要广告腔。
如果用户上传了图片或文本附件，请结合它们讨论。
如果用户消息里带有「划选原文」，请紧扣那段文字回答（改写、扩写、纠错、解释等）。`;

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
