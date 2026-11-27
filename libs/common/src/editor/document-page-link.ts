import type { EditorJsDocument } from './document';

type PageLinkChild = { id: string; slug: string; title: string };

/** 父正文里还没有指向这个子页的块时，返回加上链接后的正文。 */
export function appendPageLinkBlock(
  body: EditorJsDocument,
  child: PageLinkChild,
): EditorJsDocument | null {
  const blocks = [...(body.blocks ?? [])];
  if (
    blocks.some(
      (block) => block.type === 'pageLink' && String(block.data.pageId ?? '') === child.id,
    )
  ) {
    return null;
  }
  const title = child.title?.trim() && child.title !== '无标题' ? child.title : '无标题';
  return {
    ...body,
    time: Date.now(),
    blocks: [...blocks, { type: 'pageLink', data: { pageId: child.id, slug: child.slug, title } }],
  };
}

/** 父正文里有指向这个子页的块时，返回去掉之后的正文。 */
export function stripPageLinkBlock(body: EditorJsDocument, childId: string): EditorJsDocument | null {
  const blocks = body.blocks ?? [];
  const next = blocks.filter(
    (block) => !(block.type === 'pageLink' && String(block.data.pageId ?? '') === childId),
  );
  if (next.length === blocks.length) {
    return null;
  }
  return { ...body, time: Date.now(), blocks: next };
}
