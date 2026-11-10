import { RpcException } from '@nestjs/microservices';

jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
  TypeOrmModule: { forFeature: () => ({}) },
}));

import { ChatService } from '../../src/chat/chat.service';
import type { ConversationService } from '../../src/chat/conversation.service';
import type { RagPort } from '../../src/rag/rag-port';

function makeConversations(overrides?: Partial<ConversationService>) {
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
  } as unknown as ConversationService;
}

function makeChat(conversations = makeConversations()) {
  const rag = {
    status: () => ({
      enabled: false,
      embeddingModel: 'text-embedding-3-small',
      embeddingDim: 1536,
    }),
    searchForChat: jest.fn().mockResolvedValue([]),
  } as unknown as RagPort;
  return { chat: new ChatService(rag, conversations), conversations };
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
  const originalFetch = global.fetch;

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.AI_API_KEY;
    } else {
      process.env.AI_API_KEY = originalKey;
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
