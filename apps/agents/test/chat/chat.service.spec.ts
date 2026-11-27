import { RpcException } from '@nestjs/microservices';

jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
  TypeOrmModule: { forFeature: () => ({}) },
}));

import { ChatService } from '../../src/chat/chat.service';
import type { ConversationsService } from '../../src/conversations/conversations.service';
import type { RagPort } from '../../src/rag/rag-port';

function makeConversations(overrides?: Partial<ConversationsService>) {
  const conversation = {
    id: 'conv-1',
    bizCode: 'wiki',
    userId: 'user-1',
    accountId: null,
    title: '新对话',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  return {
    requireActor: jest.fn().mockReturnValue({
      bizCode: 'wiki',
      userId: 'user-1',
      accountId: 'acc-1',
    }),
    resolveForChat: jest.fn().mockResolvedValue(conversation),
    loadHistory: jest.fn().mockResolvedValue([]),
    mergeHistory: jest
      .fn()
      .mockImplementation((_history: unknown, incoming: unknown) => incoming),
    appendTurn: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as ConversationsService;
}

function makeChat(conversations = makeConversations()) {
  const rag = {
    status: () => ({
      enabled: false,
      embeddingModel: 'text-embedding-3-small',
      embeddingDim: 1536,
    }),
    searchForChat: jest.fn().mockResolvedValue([]),
  } as unknown as RagPort & { searchForChat: jest.Mock };
  return { chat: new ChatService(rag, conversations), conversations, rag };
}

function sentSystem(fetchMock: jest.Mock): string {
  const body = JSON.parse(String(fetchMock.mock.calls[0][1].body)) as {
    messages: Array<{ role: string; content: string }>;
  };
  return body.messages.map((item) => (typeof item.content === 'string' ? item.content : '')).join('\n');
}

function sessionPayload(body: Record<string, unknown>) {
  return {
    ...body,
    _bizCode: 'wiki',
    _session: { userId: 'user-1', accountId: 'acc-1' },
  };
}

describe('ChatService', () => {
  const originalKey = process.env.AI_API_KEY;
  const originalSearx = process.env.SEARXNG_URL;
  const originalFetch = global.fetch;

  beforeEach(() => {
    delete process.env.SEARXNG_URL;
  });

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.AI_API_KEY;
    } else {
      process.env.AI_API_KEY = originalKey;
    }
    if (originalSearx === undefined) {
      delete process.env.SEARXNG_URL;
    } else {
      process.env.SEARXNG_URL = originalSearx;
    }
    global.fetch = originalFetch;
  });

  it('status hides secrets and reports disabled without a key', () => {
    delete process.env.AI_API_KEY;
    const status = makeChat().chat.status();
    expect(status.enabled).toBe(false);
    expect(status).not.toHaveProperty('base');
    expect(status).not.toHaveProperty('key');
  });

  it('rejects chat when the key is missing', async () => {
    delete process.env.AI_API_KEY;
    await expect(
      makeChat().chat.complete(
        sessionPayload({ messages: [{ role: 'user', content: 'hi' }] }),
      ),
    ).rejects.toBeInstanceOf(RpcException);
  });

  it('returns a trimmed reply and conversationId, then persists the turn', async () => {
    process.env.AI_API_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '  你好  ' } }] }),
    }) as unknown as typeof fetch;

    const { chat, conversations } = makeChat();
    const result = await chat.complete(
      sessionPayload({ messages: [{ role: 'user', content: '写一句开场白' }] }),
    );
    expect(result).toEqual({ reply: '你好', conversationId: 'conv-1' });
    expect(conversations.appendTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        userContent: '写一句开场白',
        assistantContent: '你好',
      }),
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/chat\/completions$/),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
        }),
      }),
    );
  });

  it('falls back to text-only when vision upstream fails', async () => {
    process.env.AI_API_KEY = 'test-key';
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'no vision',
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'text ok' } }] }),
      });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await makeChat().chat.complete(
      sessionPayload({
        messages: [{ role: 'user', content: '看图' }],
        attachments: [{ kind: 'image', name: 'a.png', url: 'https://cdn.example/a.png' }],
      }),
    );
    expect(result.reply).toBe('text ok');
    expect(result.conversationId).toBe('conv-1');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('uses wiki pages only when the retrieval score is high enough', async () => {
    process.env.AI_API_KEY = 'test-key';
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '根据资料' } }] }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const { chat, rag } = makeChat();
    rag.searchForChat.mockResolvedValue([
      { docId: '1', title: '弱标题', slug: 'weak', chunkIndex: 0, content: '只有标题', score: 0.2, sourceType: 'editorjs' },
      { docId: '2', title: 'Fiber详解', slug: 'fiber', chunkIndex: 0, content: 'Fiber 把渲染拆成单元', score: 0.8, sourceType: 'editorjs' },
    ]);

    const result = await chat.complete(
      sessionPayload({ rag: true, messages: [{ role: 'user', content: 'Fiber 是什么' }] }),
    );

    expect(result.sources?.map((item) => item.title)).toEqual(['Fiber详解']);
    const sent = sentSystem(fetchMock);
    expect(sent).toContain('只根据下方参考资料');
    expect(sent).toContain('Fiber 把渲染拆成单元');
    expect(sent).not.toContain('只有标题');
    expect(sent).not.toContain('以下不是知识库内容');
  });

  it('adds a labeled general definition when the user asks how it is defined online', async () => {
    process.env.AI_API_KEY = 'test-key';
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '资料加上通用定义' } }] }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const { chat, rag } = makeChat();
    rag.searchForChat.mockResolvedValue([
      { docId: '2', title: 'Fiber详解', slug: 'fiber', chunkIndex: 0, content: 'Fiber 把渲染拆成单元', score: 0.8, sourceType: 'editorjs' },
    ]);

    const result = await chat.complete(
      sessionPayload({ rag: true, messages: [{ role: 'user', content: '网上是怎么定义的' }] }),
    );

    expect(result.sources?.map((item) => item.title)).toEqual(['Fiber详解']);
    const sent = sentSystem(fetchMock);
    expect(sent).toContain('Fiber 把渲染拆成单元');
    expect(sent).toContain('以下不是知识库内容');
  });

  it('puts SearXNG hits next to the wiki pages', async () => {
    process.env.AI_API_KEY = 'test-key';
    process.env.SEARXNG_URL = 'http://127.0.0.1:8888';
    const fetchMock = jest
      .fn()
      .mockImplementation(async (url: string) => {
        if (String(url).includes('/search')) {
          return {
            ok: true,
            json: async () => ({
              results: [
                { title: 'React Fiber', url: 'https://react.dev/fiber', content: 'A unit of work' },
                { title: 'skip', url: 'not-a-url', content: 'no' },
              ],
            }),
          };
        }
        return {
          ok: true,
          json: async () => ({ choices: [{ message: { content: '综合' } }] }),
        };
      });
    global.fetch = fetchMock as unknown as typeof fetch;
    const { chat, rag } = makeChat();
    rag.searchForChat.mockResolvedValue([
      { docId: '2', title: 'Fiber详解', slug: 'fiber', chunkIndex: 0, content: 'Fiber 把渲染拆成单元', score: 0.8, sourceType: 'editorjs' },
    ]);

    const result = await chat.complete(
      sessionPayload({ rag: true, messages: [{ role: 'user', content: 'Fiber 是什么' }] }),
    );

    expect(result.sources?.map((item) => item.title)).toEqual(['Fiber详解']);
    const chatCall = fetchMock.mock.calls.find((call) => String(call[0]).includes('/chat/completions'));
    const body = JSON.parse(String(chatCall?.[1].body)) as {
      messages: Array<{ content: string | unknown }>;
    };
    const sent = body.messages.map((item) => (typeof item.content === 'string' ? item.content : '')).join('\n');
    expect(sent).toContain('Fiber 把渲染拆成单元');
    expect(sent).toContain('【网上结果】');
    expect(sent).toContain('[React Fiber](https://react.dev/fiber)');
    expect(sent).toContain('[标题](https://地址)');
    expect(sent).not.toContain('not-a-url');
  });

  it('drops weak hits and allows labeled general knowledge', async () => {
    process.env.AI_API_KEY = 'test-key';
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '一般说明' } }] }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const { chat, rag } = makeChat();
    rag.searchForChat.mockResolvedValue([
      { docId: '1', title: 'React源码学习', slug: 'react', chunkIndex: 0, content: '待办：Fiber详解', score: 0.2, sourceType: 'editorjs' },
    ]);

    const result = await chat.complete(
      sessionPayload({ rag: true, messages: [{ role: 'user', content: 'Fiber 详情包含哪些' }] }),
    );

    expect(result.sources).toBeUndefined();
    const sent = sentSystem(fetchMock);
    expect(sent).toContain('以下不是知识库内容');
    expect(sent).not.toContain('待办：Fiber详解');
  });

  it('maps upstream HTTP errors to AI_UPSTREAM_*', async () => {
    process.env.AI_API_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'rate limited',
    }) as unknown as typeof fetch;

    await expect(
      makeChat().chat.complete(
        sessionPayload({ messages: [{ role: 'user', content: 'hi' }] }),
      ),
    ).rejects.toMatchObject({
      error: { status: 502, message: 'AI_UPSTREAM_429' },
    });
  });
});
