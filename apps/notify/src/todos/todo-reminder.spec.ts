import { deliverDueTodos } from './todo-reminder-run';

describe('TodoReminder', () => {
  const now = new Date('2026-11-09T16:00:00.000Z');

  function remind(query: jest.Mock, send: jest.Mock, mode: 'midnight' | 'catch-up') {
    return deliverDueTodos({ query, send, warn: () => undefined }, now, mode);
  }

  it('sends one socket notice for an open todo due that day', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([
        {
          id: '11111111-1111-1111-1111-111111111111',
          bizCode: 'wiki',
          userId: 'user-1',
          title: '写周报',
          content: '周五前交',
        },
      ])
      .mockResolvedValueOnce([{ id: '11111111-1111-1111-1111-111111111111' }]);
    const send = jest.fn().mockResolvedValue({ id: 'notice-1' });
    const sent = await remind(query, send, 'midnight');

    expect(sent).toBe(1);
    expect(String(query.mock.calls[0][0])).not.toContain('created_at <');
    expect(query.mock.calls[0][1]).toEqual(['2026-11-10']);
    expect(send).toHaveBeenCalledWith({
      bizCode: 'wiki',
      userId: 'user-1',
      title: '待办到期：写周报',
      content: '今天是截止日。周五前交',
      category: 'todo',
      source: 'system',
      data: { todoId: '11111111-1111-1111-1111-111111111111' },
      dueAt: null,
    });
  });

  it('catch-up only includes todos created before midnight', async () => {
    const query = jest.fn().mockResolvedValueOnce([]);
    await remind(query, jest.fn(), 'catch-up');
    expect(String(query.mock.calls[0][0])).toContain('created_at < $2::timestamptz');
    expect(query.mock.calls[0][1]).toEqual(['2026-11-10', '2026-11-09T16:00:00.000Z']);
  });

  it('skips a todo another worker already claimed', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([
        { id: 'todo-1', bizCode: 'wiki', userId: 'user-1', title: '写周报', content: '周五前交' },
      ])
      .mockResolvedValueOnce([]);
    const send = jest.fn();
    const sent = await remind(query, send, 'midnight');
    expect(sent).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });

  it('releases the claim when sending the notice fails', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([
        { id: 'todo-1', bizCode: 'wiki', userId: 'user-1', title: '写周报', content: '周五前交' },
      ])
      .mockResolvedValueOnce([{ id: 'todo-1' }])
      .mockResolvedValueOnce([]);
    const send = jest.fn().mockRejectedValue(new Error('down'));
    const sent = await remind(query, send, 'midnight');
    expect(sent).toBe(0);
    expect(String(query.mock.calls[2][0])).toContain('SET reminded_on = NULL');
    expect(query.mock.calls[2][1]).toEqual(['todo-1', '2026-11-10']);
  });
});
