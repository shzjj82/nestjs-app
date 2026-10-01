import { RpcException } from '@nestjs/microservices';
import { ChatService } from '../../src/chat/chat.service';

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
    const status = new ChatService().status();
    expect(status.enabled).toBe(false);
    expect(status).not.toHaveProperty('base');
    expect(status).not.toHaveProperty('key');
  });

  it('rejects chat when the key is missing', async () => {
    delete process.env.AI_API_KEY;
    await expect(
      new ChatService().complete({ messages: [{ role: 'user', content: 'hi' }] }),
    ).rejects.toBeInstanceOf(RpcException);
  });

  it('returns a trimmed reply from chat/completions', async () => {
    process.env.AI_API_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '  你好  ' } }] }),
    }) as unknown as typeof fetch;

    const result = await new ChatService().complete({
      messages: [{ role: 'user', content: '写一句开场白' }],
    });
    expect(result).toEqual({ reply: '你好' });
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

    const result = await new ChatService().complete({
      messages: [{ role: 'user', content: '看图' }],
      attachments: [{ kind: 'image', name: 'a.png', url: 'https://cdn.example/a.png' }],
    });
    expect(result.reply).toBe('text ok');
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
      new ChatService().complete({ messages: [{ role: 'user', content: 'hi' }] }),
    ).rejects.toMatchObject({
      error: { status: 502, message: 'AI_UPSTREAM_429' },
    });
  });
});
