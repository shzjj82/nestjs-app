import { RpcException } from '@nestjs/microservices';
import { linkifyBareCitations } from '@app/common';
import { parseChatInput } from '../../src/modules/chat/input';
import {
  applyRagPolicy,
  asksForOutsideDefinition,
  buildHistoryMessages,
  contextAppendix,
  describeAttachments,
  normalizeMessages,
  RAG_HIT_SCORE,
  webResultsAppendix,
} from '../../src/modules/chat/messages';

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
    expect(policy.context).toContain('类型：页面正文');
    expect(policy.context).toContain('定位：页面「正文」');
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

  it('labels a file hit with its type and filename', () => {
    const policy = applyRagPolicy([
      {
        title: '准备条件',
        slug: 'prep',
        content: '【附件：资质.docx】\n企业认证费用',
        sourceType: 'docx',
        sourceName: '资质.docx',
        score: 0.8,
      },
    ]);
    expect(policy.context).toContain('类型：Word');
    expect(policy.context).toContain('定位：文件「资质.docx」');
    expect(policy.context).not.toContain('类型：docx');
  });

  it('drops every chunk below the line and allows labeled general knowledge', () => {
    const policy = applyRagPolicy([hit('待办标题', 0.2)]);
    expect(policy.mode).toBe('general');
    expect(policy.sources).toEqual([]);
    expect(policy.context).toBe('');
    expect(policy.systemAppendix).toContain('以下不是知识库内容');
  });
});

describe('web citations', () => {
  it('shows a markdown link in the web appendix', () => {
    expect(
      webResultsAppendix([{ title: 'React Fiber', url: 'https://react.dev/fiber', content: 'A unit of work' }]),
    ).toContain('[React Fiber](https://react.dev/fiber)');
  });

  it('turns a book title plus a bare url into a markdown link', () => {
    const raw =
      '（《香港迪士尼樂園度假區 | 官方網站》 https://www.hongkongdisneyland.com/zh-hk/ ）\n' +
      '（《迪士尼调查问卷》 https://www.wenjuan.com/lib_detail_full/57723bbba320fc84d20009a0/ ）';
    const linked = linkifyBareCitations(raw);
    expect(linked).toBe(
      '（[香港迪士尼樂園度假區 | 官方網站](https://www.hongkongdisneyland.com/zh-hk/) ）\n' +
        '（[迪士尼调查问卷](https://www.wenjuan.com/lib_detail_full/57723bbba320fc84d20009a0/) ）',
    );
    expect(linkifyBareCitations(linked)).toBe(linked);
  });

  it('leaves an existing markdown link and a fenced url alone', () => {
    const raw =
      '（[上海迪士尼攻略（6次吐血总结）](https://www.zhihu.com/tardis/zm/art/256381785)）\n' +
      '```\n《示例》 https://example.com/keep\n```\n' +
      '知识库《迪士尼游玩攻略》没有写 18。';
    expect(linkifyBareCitations(raw)).toBe(raw);
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
