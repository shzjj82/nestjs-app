import {
  buildWikiRemindNotice,
  deliverWikiReminders,
  type WikiRemindDeps,
  type WikiRemindRow,
  type WikiRemindSlot,
} from '../../src/todos/todo-reminder-run';

describe('wiki TodoReminder', () => {
  const now = new Date('2026-11-09T16:00:00.000Z');

  const baseRow = (over: Partial<WikiRemindRow> = {}): WikiRemindRow => ({
    id: '11111111-1111-1111-1111-111111111111',
    bizCode: 'wiki',
    userId: 'user-1',
    title: 'Weekly report',
    content: 'body',
    status: 'pending',
    startsAt: '2026-11-10',
    dueAt: null,
    data: {
      notify: true,
      pageId: 'page-1',
      localItemId: 'li-1',
      page: {
        id: 'page-1',
        slug: 'weekly',
        title: 'Sprint notes',
        appCode: 'wiki',
        kind: 'doc',
      },
    },
    ...over,
  });

  it('builds locale-neutral notice with kind and page/file fields', () => {
    const notice = buildWikiRemindNotice(baseRow(), 'todo.started');
    expect(notice).toEqual({
      bizCode: 'wiki',
      userId: 'user-1',
      title: 'Weekly report',
      content: 'Sprint notes\nweekly\nli-1\nbody',
      category: 'todo',
      source: 'wiki',
      data: expect.objectContaining({
        kind: 'todo.started',
        todoId: '11111111-1111-1111-1111-111111111111',
        pageId: 'page-1',
        localItemId: 'li-1',
        startsAt: '2026-11-10',
        page: expect.objectContaining({
          id: 'page-1',
          slug: 'weekly',
          title: 'Sprint notes',
        }),
      }),
    });
    expect(notice.title).not.toMatch(/待办|催办|开始|进度/);
    expect(notice.content).not.toMatch(/待办已开始|请更新|催办：/);
  });

  it('claims and sends started / overdue / progress in order', async () => {
    const started = baseRow();
    const overdue = baseRow({
      id: '22222222-2222-2222-2222-222222222222',
      status: 'in_progress',
      data: { notify: true, end: '2026-11-09', pageId: 'page-2' },
    });
    const progress = baseRow({
      id: '33333333-3333-3333-3333-333333333333',
      status: 'in_progress',
      data: { notify: true, end: '2026-11-15', pageId: 'page-3' },
    });
    const listed: WikiRemindSlot[] = [];
    const deps: WikiRemindDeps = {
      list: async (slot) => {
        listed.push(slot);
        if (slot === 'todo.started') {
          return { items: [started], today: '2026-11-10' };
        }
        if (slot === 'todo.overdue') {
          return { items: [overdue], today: '2026-11-10' };
        }
        return { items: [progress], today: '2026-11-10' };
      },
      claim: jest.fn().mockResolvedValue(true),
      release: jest.fn(),
      send: jest.fn().mockResolvedValue({ id: 'n1' }),
      warn: () => undefined,
    };

    const sent = await deliverWikiReminders(deps, now, 'midnight');
    expect(sent).toBe(3);
    expect(listed).toEqual(['todo.started', 'todo.overdue', 'todo.progress']);
    expect(deps.send).toHaveBeenCalledTimes(3);
    expect(deps.send).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ data: expect.objectContaining({ kind: 'todo.started' }) }),
    );
    expect(deps.send).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ data: expect.objectContaining({ kind: 'todo.overdue' }) }),
    );
    expect(deps.send).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ data: expect.objectContaining({ kind: 'todo.progress' }) }),
    );
  });

  it('releases claim when send fails', async () => {
    const row = baseRow();
    const release = jest.fn();
    const deps: WikiRemindDeps = {
      list: async (slot) =>
        slot === 'todo.started'
          ? { items: [row], today: '2026-11-10' }
          : { items: [], today: '2026-11-10' },
      claim: async () => true,
      release,
      send: async () => {
        throw new Error('down');
      },
      warn: () => undefined,
    };

    const sent = await deliverWikiReminders(deps, now, 'midnight');
    expect(sent).toBe(0);
    expect(release).toHaveBeenCalledWith('todo.started', row.id, '2026-11-10');
  });
});
