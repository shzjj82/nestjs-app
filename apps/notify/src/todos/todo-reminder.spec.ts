import { deliverDueTodos } from './todo-reminder-run';

describe('TodoReminder (legacy non-wiki)', () => {
  const now = new Date('2026-11-09T16:00:00.000Z'); // 上海 2026-11-10 00:00

  function remind(query: jest.Mock, send: jest.Mock, mode: 'midnight' | 'catch-up') {
    return deliverDueTodos({ query, send, warn: () => undefined }, now, mode);
  }

  it('sends locale-neutral due notice for non-wiki todos', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([
        {
          id: 'legacy-1',
          bizCode: 'blog',
          userId: 'user-1',
          title: '写周报',
          content: '周五前交',
        },
      ])
      .mockResolvedValueOnce([{ id: 'legacy-1' }]);
    const send = jest.fn().mockResolvedValue({ id: 'notice-1' });
    const sent = await remind(query, send, 'midnight');

    expect(sent).toBe(1);
    expect(String(query.mock.calls[0][0])).toContain("source <> 'wiki'");
    expect(send).toHaveBeenCalledWith({
      bizCode: 'blog',
      userId: 'user-1',
      title: '写周报',
      content: '周五前交',
      category: 'todo',
      source: 'system',
      status: 'pending',
      data: { kind: 'todo.due', todoId: 'legacy-1' },
      dueAt: null,
      startsAt: null,
    });
  });

  it('catch-up only includes todos created before midnight', async () => {
    const query = jest.fn().mockResolvedValue([]);
    await remind(query, jest.fn(), 'catch-up');
    expect(String(query.mock.calls[0][0])).toContain('created_at < $2::timestamptz');
    expect(query.mock.calls[0][1]).toEqual(['2026-11-10', '2026-11-09T16:00:00.000Z']);
  });

  it('skips a todo another worker already claimed', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([
        {
          id: 'todo-1',
          bizCode: 'blog',
          userId: 'user-1',
          title: '写周报',
          content: '周五前交',
        },
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
        {
          id: 'todo-1',
          bizCode: 'blog',
          userId: 'user-1',
          title: '写周报',
          content: '周五前交',
        },
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
