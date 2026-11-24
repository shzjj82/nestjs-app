import { RpcException } from '@nestjs/microservices';
import { parseChatInput } from '../../src/chat/chat-input';
import {
  applyRagPolicy,
  asksForOutsideDefinition,
  buildHistoryMessages,
  contextAppendix,
  describeAttachments,
  normalizeMessages,
  RAG_HIT_SCORE,
} from '../../src/chat/chat-messages';

describe('normalizeMessages', () => {
  it('keeps the last 24 non-empty user/assistant turns', () => {
    const messages = Array.from({ length: 30 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `m${i}`,
    }));
    const normalized = normalizeMessages(messages);
    expect(normalized).toHaveLength(24);
    expect(normalized[0].content).toBe('m6');
    expect(normalized.at(-1)?.content).toBe('m29');
  });

  it('drops system roles and blank content', () => {
    expect(
      normalizeMessages([
        { role: 'system', content: 'nope' },
        { role: 'user', content: '  hello  ' },
        { role: 'assistant', content: '   ' },
      ]),
    ).toEqual([{ role: 'user', content: 'hello' }]);
  });
});

describe('attachments', () => {
  it('splits image urls and text parts', () => {
    const { imageUrls, textParts } = describeAttachments([
      { kind: 'image', name: 'a.png', url: 'https://cdn.example/a.png' },
      { kind: 'text', name: 'note.md', text: '草稿' },
    ]);
    expect(imageUrls).toEqual(['https://cdn.example/a.png']);
    expect(textParts[0]).toContain('【附件文本：note.md】');
    expect(contextAppendix([
      { kind: 'image', name: 'a.png', url: 'https://cdn.example/a.png' },
    ])).toContain('可用图片 URL');
  });
});

describe('buildHistoryMessages', () => {
  it('attaches images only on the last user turn when multimodal', () => {
    const built = buildHistoryMessages(
      'sys',
      [
        { role: 'user', content: '先看图' },
        { role: 'assistant', content: '好' },
        { role: 'user', content: '再写' },
      ],
      '可用图片 URL：\nhttps://cdn.example/a.png',
      ['https://cdn.example/a.png'],
      true,
    );
    expect(built[0]).toEqual({ role: 'system', content: 'sys' });
    expect(built[1].content).toBe('先看图');
    const last = built.at(-1);
    expect(Array.isArray(last?.content)).toBe(true);
    expect(last?.content).toEqual(
      expect.arrayContaining([
        { type: 'text', text: expect.stringContaining('再写') },
        { type: 'image_url', image_url: { url: 'https://cdn.example/a.png' } },
      ]),
    );
  });
});

describe('applyRagPolicy', () => {
  const hit = (title: string, score: number) => ({
    title,
    slug: title,
    content: `${title}的正文`,
    sourceType: 'editorjs',
    score,
  });

  it('keeps chunks at or above the hit score', () => {
    const policy = applyRagPolicy([hit('弱标题', RAG_HIT_SCORE - 0.01), hit('正文', RAG_HIT_SCORE)]);
    expect(policy.mode).toBe('grounded');
    expect(policy.sources.map((item) => item.title)).toEqual(['正文']);
    expect(policy.context).toContain('### [1] 正文');
    expect(policy.context).toContain('正文的正文');
    expect(policy.context).not.toContain('弱标题');
    expect(policy.context).not.toContain('editorjs');
    expect(policy.systemAppendix).toContain('只根据下方参考资料');
    expect(policy.systemAppendix).not.toContain('以下不是知识库内容');
  });

  it('keeps the wiki hit and allows a labeled general definition when asked', () => {
    expect(asksForOutsideDefinition('网上是怎么定义的')).toBe(true);
    const policy = applyRagPolicy([hit('Fiber详解', 0.8)], '网上是怎么定义的');
    expect(policy.mode).toBe('grounded');
    expect(policy.sources.map((item) => item.title)).toEqual(['Fiber详解']);
    expect(policy.context).toContain('Fiber详解的正文');
    expect(policy.systemAppendix).toContain('先写资料中的定义');
    expect(policy.systemAppendix).toContain('以下不是知识库内容');
  });

  it('drops every chunk below the line and allows labeled general knowledge', () => {
    const policy = applyRagPolicy([hit('待办标题', 0.2)]);
    expect(policy.mode).toBe('general');
    expect(policy.sources).toEqual([]);
    expect(policy.context).toBe('');
    expect(policy.systemAppendix).toContain('以下不是知识库内容');
  });
});

describe('parseChatInput', () => {
  it('requires a trailing user message', () => {
    expect(() => parseChatInput({ messages: [{ role: 'assistant', content: 'hi' }] })).toThrow(
      RpcException,
    );
    const input = parseChatInput({
      messages: [{ role: 'user', content: '写一句' }],
      system: ' 自定义 ',
    });
    expect(input.system).toBe('自定义');
    expect(input.sync).toBe(true);
    expect(input.messages).toEqual([{ role: 'user', content: '写一句' }]);
  });
});
