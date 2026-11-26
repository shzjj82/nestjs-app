import { formatTodoContext, todoStatusQuery, withTodoContext } from '../../src/chat/todo-context';

describe('todo context', () => {
  it('按问法收窄状态', () => {
    expect(todoStatusQuery('有哪些未完成待办')).toBe('pending,in_progress');
    expect(todoStatusQuery('已完成的任务')).toBe('done');
    expect(todoStatusQuery('待办和已完成')).toBeUndefined();
  });

  it('按页面列出待办，并关掉知识库检索', () => {
    const text = formatTodoContext([
      {
        title: '提交材料',
        status: 'pending',
        startsAt: '2026-01-01T00:00:00.000Z',
        dueAt: '2026-01-03T00:00:00.000Z',
        page: { title: '准备条件' },
      },
    ]);
    expect(text).toContain('《准备条件》');
    expect(text).toContain('- 未开始：提交材料（2026-01-01至2026-01-03）');
    const payload = withTodoContext({ messages: [{ role: 'user', content: '有哪些待办' }] }, text);
    expect(payload.rag).toBe(false);
    expect(String((payload.messages as Array<{ content: string }>)[0].content)).toContain('提交材料');
  });

  it('没有待办时明确说没有', () => {
    expect(formatTodoContext([])).toContain('当前没有符合条件的待办');
  });
});
