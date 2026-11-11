import {
  finishTodo,
  parseSend,
  parseUpdateMine,
  requireInternal,
  toPage,
  unreadOnly,
} from './input';

describe('notify input', () => {
  const original = process.env.NOTIFY_INTERNAL_KEY;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.NOTIFY_INTERNAL_KEY;
    } else {
      process.env.NOTIFY_INTERNAL_KEY = original;
    }
  });

  it('parses a send command and drops empty data', () => {
    expect(
      parseSend(
        {
          bizCode: 'recycle',
          userId: 'user-1',
          title: '订单已完成',
          content: '回收款已到账',
          data: '',
        },
        'service',
      ),
    ).toEqual({
      bizCode: 'recycle',
      userId: 'user-1',
      title: '订单已完成',
      content: '回收款已到账',
      category: 'system',
      source: 'service',
      status: 'pending',
      data: null,
      dueAt: null,
      startsAt: null,
    });
  });

  it('rejects topic-unsafe ids', () => {
    expect(() =>
      parseSend(
        {
          bizCode: 'recycle/../x',
          userId: 'user-1',
          title: 'hi',
          content: 'there',
        },
        'service',
      ),
    ).toThrow(/bizCode/);
  });

  it('requires the internal key', () => {
    process.env.NOTIFY_INTERNAL_KEY = 'secret';
    expect(() => requireInternal({ _internal: 'nope' })).toThrow(/密钥/);
    expect(() => requireInternal({ _internal: 'secret' })).not.toThrow();
  });

  it('keeps an optional due date and rejects a finished todo', () => {
    const command = parseSend(
      {
        bizCode: 'blog',
        userId: 'user-1',
        title: '补资料',
        content: '请上传合同',
        dueAt: '2026-12-01T00:00:00.000Z',
        startsAt: '2026-11-20',
      },
      'service',
    );
    expect(command.dueAt?.toISOString()).toBe('2026-12-01T00:00:00.000Z');
    expect(command.startsAt).toBe('2026-11-20');
    expect(finishTodo('open', 'cancel')).toBe('cancelled');
    expect(finishTodo('pending', 'done')).toBe('done');
    expect(() => finishTodo('done', 'cancel')).toThrow(/活跃待办/);
  });

  it('pages and unread flags', () => {
    expect(toPage('2', '1000')).toEqual({ page: 2, pageSize: 100, skip: 100 });
    expect(unreadOnly({ unread: '1' })).toBe(true);
    expect(unreadOnly({})).toBe(false);
  });

  it('allows update without content', () => {
    const command = parseUpdateMine({
      title: '通知消息',
      category: 'page',
      dueAt: '2026-10-27T23:59:59.000Z',
      startsAt: '2026-10-27',
      data: { notify: true, start: '2026-10-27', end: '2026-10-27' },
    });
    expect(command.title).toBe('通知消息');
    expect(command.category).toBe('page');
    expect(command.startsAt).toBe('2026-10-27');
    expect(command.content).toBeUndefined();
  });
});
