import type { CategoryKind } from './category';
import type { DocKind } from './doc-kinds';
import type { EditorJsDocument } from './document';

export type DocPost = {
  id: string;
  appCode: string;
  slug: string;
  title: string;
  type: string;
  kind: DocKind;
  parentId: string | null;
  treeSort: number;
  categoryName: string;
  categoryColor: string;
  categoryKind: CategoryKind;
  summary: string;
  coverUrl: string;
  props: Record<string, unknown>;
  tags: string[];
  bodyFormat: string;
  authorId: string | null;
  teamId: string | null;
  body: EditorJsDocument;
  visibility: 'private' | 'public';
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DocPostListItem = Omit<DocPost, 'body'>;

export function iso(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  return value instanceof Date ? value.toISOString() : value;
}
