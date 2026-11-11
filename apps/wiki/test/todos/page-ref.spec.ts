import {
  mergeTodoData,
  pageFromTodoData,
  requirePageId,
} from '../../src/todos/page-ref';

describe('wiki todo page-ref', () => {
  const page = {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    slug: 'week-report',
    title: '周报',
    appCode: 'wiki',
    kind: 'article',
  };

  it('requires a uuid pageId', () => {
    expect(() => requirePageId('')).toThrow(
      expect.objectContaining({ error: { status: 400, message: expect.any(String) } }),
    );
    expect(requirePageId(page.id)).toBe(page.id);
  });

  it('merges page into todo data for notify / jump', () => {
    expect(mergeTodoData({ foo: 1 }, page)).toEqual({
      foo: 1,
      pageId: page.id,
      page,
    });
  });

  it('reads page back from todo data', () => {
    expect(pageFromTodoData({ pageId: page.id, page })).toEqual(page);
    expect(pageFromTodoData({})).toBeNull();
  });
});
