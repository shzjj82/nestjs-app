import { locateForRagSource } from '../../src/rag/rag-locate';

describe('locateForRagSource', () => {
  it('opens the page and then locates the excerpt', () => {
    expect(locateForRagSource({ docId: 'doc-1', content: 'Fiber 把渲染拆开' })).toEqual({
      type: 'page',
      pageId: 'doc-1',
      mode: 'push',
      next: { type: 'text', text: 'Fiber 把渲染拆开', mode: 'here' },
    });
  });

  it('opens the page when the excerpt is empty', () => {
    expect(locateForRagSource({ docId: 'doc-1', content: '   ' })).toEqual({
      type: 'page',
      pageId: 'doc-1',
      mode: 'push',
    });
    expect(locateForRagSource({ docId: '  ' })).toBeNull();
  });
});
