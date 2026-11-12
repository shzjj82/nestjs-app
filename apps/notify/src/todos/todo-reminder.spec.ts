import { deliverDueTodos } from './todo-reminder-run';

describe('TodoReminder', () => {
  const now = new Date('2026-11-09T16:00:00.000Z'); // 上海 2026-11-10 00:00

  function remind(query: jest.Mock, send: jest.Mock, mode: 'midnight' | 'catch-up') {
    return deliverDueTodos({ query, send, warn: () => undefined }, now, mode);
  }

  function emptyWikiQueries(query: jest.Mock) {
    // started, overdue, progress, legacy
    query.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
  }

  it('sends todo.started on start day without changing status', async () => {
    const row = {
      id: '11111111-1111-1111-1111-111111111111',
      bizCode: 'wiki',
      userId: 'user-1',
      title: '写周报',
      content: '周五前交',
      status: 'pending',
      startsAt: '2026-11-10',
      dueAt: null,
      data: { notify: true, pageId: 'page-1', localItemId: 'li-1' },
    };
    const query = jest
      .fn()
      .mockResolvedValueOnce([row]) // started select
      .mockResolvedValueOnce([{ id: row.id }]) // claim started_notice_at only
      .mockResolvedValueOnce([]) // overdue
      .mockResolvedValueOnce([]) // progress
      .mockResolvedValueOnce([]); // legacy
    const send = jest.fn().mockResolvedValue({ id: 'notice-1' });
    const sent = await deliverDueTodos(
      { query, send, warn: () => undefined },
      now,
      'midnight',
    );

    expect(sent).toBe(1);
    expect(String(query.mock.calls[0][0])).toContain("source = 'wiki'");
    expect(String(query.mock.calls[1][0])).toContain('SET started_notice_at');
    expect(String(query.mock.calls[1][0])).not.toContain("status = 'in_progress'");
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '待办已开始',
        data: expect.objectContaining({
          kind: 'todo.started',
          todoId: row.id,
          pageId: 'page-1',
          localItemId: 'li-1',
        }),
      }),
    );
  });

  it('sends progress for in_progress wiki todos within the window', async () => {
    const row = {
      id: 'todo-progress',
      bizCode: 'wiki',
      userId: 'user-1',
      title: '写周报',
      content: '进行中',
      status: 'in_progress',
      startsAt: '2026-11-01',
      dueAt: new Date('2026-11-15T00:00:00+08:00'),
      data: { notify: true, end: '2026-11-15' },
    };
    const query = jest
      .fn()
      .mockResolvedValueOnce([]) // started
      .mockResolvedValueOnce([]) // overdue
      .mockResolvedValueOnce([row]) // progress
      .mockResolvedValueOnce([{ id: row.id }]) // claim
      .mockResolvedValueOnce([]); // legacy
    const send = jest.fn().mockResolvedValue({ id: 'n2' });
    const sent = await remind(query, send, 'midnight');
    expect(sent).toBe(1);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kind: 'todo.progress', todoId: row.id }),
      }),
    );
  });

  it('sends overdue and skips progress for the same overdue todo', async () => {
    const overdue = {
      id: 'todo-overdue',
      bizCode: 'wiki',
      userId: 'user-1',
      title: '写周报',
      content: '已逾期',
      status: 'in_progress',
      startsAt: '2026-11-01',
      dueAt: null,
      data: { notify: true, end: '2026-11-09' },
    };
    const query = jest
      .fn()
      .mockResolvedValueOnce([]) // started
      .mockResolvedValueOnce([overdue]) // overdue select
      .mockResolvedValueOnce([{ id: overdue.id }]) // claim
      .mockResolvedValueOnce([]) // progress select (SQL excludes overdue)
      .mockResolvedValueOnce([]); // legacy
    const send = jest.fn().mockResolvedValue({ id: 'n3' });
    const sent = await remind(query, send, 'midnight');
    expect(sent).toBe(1);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kind: 'todo.overdue' }),
      }),
    );
  });

  it('keeps legacy due notice for non-wiki todos', async () => {
    const query = jest.fn();
    emptyWikiQueries(query);
    query
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
    expect(String(query.mock.calls[3][0])).toContain("source <> 'wiki'");
    expect(send).toHaveBeenCalledWith({
      bizCode: 'blog',
      userId: 'user-1',
      title: '待办到期：写周报',
      content: '今天是截止日。周五前交',
      category: 'todo',
      source: 'system',
      status: 'pending',
      data: { todoId: 'legacy-1' },
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
      .mockResolvedValueOnce([]) // started
      .mockResolvedValueOnce([
        {
          id: 'todo-1',
          bizCode: 'wiki',
          userId: 'user-1',
          title: '写周报',
          content: '周五前交',
          status: 'in_progress',
          startsAt: '2026-11-01',
          data: { notify: true, end: '2026-11-01' },
        },
      ])
      .mockResolvedValueOnce([]) // claim miss
      .mockResolvedValueOnce([]) // progress
      .mockResolvedValueOnce([]); // legacy
    const send = jest.fn();
    const sent = await remind(query, send, 'midnight');
    expect(sent).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });

  it('releases the claim when sending the notice fails', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([]) // started
      .mockResolvedValueOnce([
        {
          id: 'todo-1',
          bizCode: 'wiki',
          userId: 'user-1',
          title: '写周报',
          content: '周五前交',
          status: 'pending',
          startsAt: '2026-11-01',
          data: { notify: true, end: '2026-11-01' },
        },
      ])
      .mockResolvedValueOnce([{ id: 'todo-1' }]) // claim
      .mockResolvedValueOnce([]) // release
      .mockResolvedValueOnce([]) // progress
      .mockResolvedValueOnce([]); // legacy
    const send = jest.fn().mockRejectedValue(new Error('down'));
    const sent = await remind(query, send, 'midnight');
    expect(sent).toBe(0);
    expect(String(query.mock.calls[3][0])).toContain('SET last_overdue_notice_on = NULL');
    expect(query.mock.calls[3][1]).toEqual(['todo-1', '2026-11-10']);
  });
});
