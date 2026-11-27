import type { WikiLocate } from '@app/common';

/**
 * 知识库命中的跳转。和编辑器 locateFromSource 一致：
 * 打开文档，摘录非空时再在当前页定位这段文字。
 */
export function locateForRagSource(source: { docId?: string; content?: string }): WikiLocate | null {
  const pageId = (source.docId ?? '').trim();
  if (!pageId) {
    return null;
  }
  const text = (source.content ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!text) {
    return { type: 'page', pageId, mode: 'push' };
  }
  return {
    type: 'page',
    pageId,
    mode: 'push',
    next: { type: 'text', text, mode: 'here' },
  };
}
