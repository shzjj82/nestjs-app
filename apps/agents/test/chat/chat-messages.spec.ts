import { RpcException } from '@nestjs/microservices';
import { parseChatInput } from '../../src/chat/chat-input';
import {
  buildHistoryMessages,
  contextAppendix,
  describeAttachments,
  normalizeMessages,
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
