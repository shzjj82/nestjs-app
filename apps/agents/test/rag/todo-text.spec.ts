import { formatTodoIndexText, mergeRagTodos, ragTodoFromRecord, todosFromEditorJs } from '../../src/modules/rag/text/todo-text';

describe('todo index text', () => {
  it('reads unsynced todo items from the page body', () => {
    const items = todosFromEditorJs({
      blocks: [
        {
          type: 'todo',
          data: {
            listId: 'list-1',
            ids: ['remote-1'],
            items: [
              { text: '提交材料', status: 'pending', start: '2026-01-01', end: '2026-01-03' },
              { text: '  ', status: 'pending' },
            ],
          },
        },
      ],
    });
    expect(items).toEqual([
      {
        title: '提交材料',
        status: 'pending',
        startsAt: '2026-01-01',
        dueAt: '2026-01-03',
        content: '',
      },
    ]);
  });

  it('keeps remote tasks and skips a local item with the same title', () => {
    const remote = [
      { title: '提交材料', status: 'in_progress', startsAt: '2026-01-01', dueAt: '2026-01-03', content: '' },
    ];
    const local = [
      { title: '提交材料', status: 'pending', startsAt: '', dueAt: '', content: '' },
      { title: '联调', status: 'pending', startsAt: '', dueAt: '', content: '' },
    ];
    expect(mergeRagTodos(remote, local).map((item) => item.title)).toEqual(['提交材料', '联调']);
  });

  it('formats status, range and detail for embedding', () => {
    const text = formatTodoIndexText([
      ragTodoFromRecord({
        title: '提交材料',
        status: 'pending',
        startsAt: '2026-01-01',
        dueAt: '2026-01-03T23:59:59.000Z',
        content: '带上营业执照',
        data: { kind: 'task' },
      })!,
    ]);
    expect(text).toBe('【待办】\n- 未开始：提交材料（2026-01-01至2026-01-03）\n带上营业执照');
  });

  it('skips the list shell', () => {
    expect(ragTodoFromRecord({ title: '待办', status: 'pending', data: { kind: 'list' } })).toBeNull();
  });
});
