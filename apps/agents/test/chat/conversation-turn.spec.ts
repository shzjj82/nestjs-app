jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import { ConversationService } from '../../src/chat/conversation.service';

describe('ConversationService.startTurn', () => {
  it('stores the question and an empty answer before the model finishes', async () => {
    const stored = new Map<string, { id: string; role: string; content: string; conversationId: string }>();
    let seq = 0;
    const messages = {
      exist: jest.fn().mockResolvedValue(false),
      create: jest.fn((row: { role: string; content: string; conversationId: string }) => ({ ...row })),
      save: jest.fn(async (row: { id?: string; role: string; content: string; conversationId: string }) => {
        const saved = { ...row, id: row.id ?? `${row.role}-${++seq}` };
        stored.set(saved.id, saved);
        return saved;
      }),
      findOne: jest.fn(async ({ where }: { where: { id: string } }) => stored.get(where.id) ?? null),
    };
    const conversations = {
      save: jest.fn(async (row: { title: string }) => row),
      update: jest.fn(),
    };
    const service = new ConversationService(conversations as never, messages as never);
    const conversation = {
      id: 'conv-1',
      title: '新对话',
      updatedAt: new Date(0),
    };

    const turn = await service.startTurn({
      conversation: conversation as never,
      userContent: '小程序上线要准备什么',
    });

    expect(turn.assistantMessageId).toBe('assistant-2');
    expect(stored.get('user-1')?.content).toBe('小程序上线要准备什么');
    expect(stored.get('assistant-2')?.content).toBe('');
    expect(conversation.title).toBe('小程序上线要准备什么');

    await service.finishAssistant(turn.assistantMessageId, '企业资质');
    expect(stored.get('assistant-2')?.content).toBe('企业资质');
    expect(conversations.update).toHaveBeenCalledWith({ id: 'conv-1' }, expect.any(Object));
  });
});
