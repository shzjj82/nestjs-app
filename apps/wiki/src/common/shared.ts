/**
 * docs 微服务内部共享类型与工具（通用原语）。
 * 产品品牌文案、默认分类、前台路由保留字由调用方自行定义，勿写入本文件。
 */
import { type DocKind } from './doc-kinds';

export type EditorJsBlock = {
  id?: string;
  type: string;
  data: Record<string, unknown>;
};

export type EditorJsDocument = {
  time?: number;
  version?: string;
  blocks: EditorJsBlock[];
};

export type CategoryKind = 'article';

/** 调用方自定义的色值 token：1–32 位，字母数字、下划线、连字符。本服务不内置色板。 */
export function isStoredColor(value: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,31}$/.test(value);
}

export type Category = {
  id: string;
  appCode: string;
  slug: string;
  name: string;
  hint: string;
  color: string;
  kind: CategoryKind;
  nav: boolean;
  sort: number;
  createdAt: string;
  updatedAt: string;
};

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

export function emptyEditorDocument(): EditorJsDocument {
  return { time: Date.now(), version: '2.30.7', blocks: [] };
}

export function starterArticleDocument(): EditorJsDocument {
  return {
    time: Date.now(),
    version: '2.30.7',
    blocks: [{ type: 'header', data: { text: '', level: 1 } }],
  };
}

export function isEditorJsDocument(value: unknown): value is EditorJsDocument {
  return Boolean(
    value && typeof value === 'object' && Array.isArray((value as EditorJsDocument).blocks),
  );
}

export function normalizeEditorDocument(value: unknown): EditorJsDocument {
  if (isEditorJsDocument(value)) {
    return {
      time: typeof value.time === 'number' ? value.time : Date.now(),
      version: typeof value.version === 'string' ? value.version : '2.30.7',
      blocks: value.blocks,
    };
  }
  if (typeof value === 'string') {
    try {
      return normalizeEditorDocument(JSON.parse(value));
    } catch {
      const trimmed = value.trim();
      return {
        time: Date.now(),
        version: '2.30.7',
        blocks: trimmed ? [{ type: 'paragraph', data: { text: trimmed } }] : [],
      };
    }
  }
  return emptyEditorDocument();
}

export { DOC_KINDS, isDocKind, resolveDocKind } from './doc-kinds';
export type { DocKind } from './doc-kinds';

export function isCategoryKind(value: string): value is CategoryKind {
  return value === 'article';
}

export function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    const name = String(item ?? '')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 16);
    if (!name) {
      continue;
    }
    const key = name.toLocaleLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(name);
    if (out.length >= 20) {
      break;
    }
  }
  return out;
}

export function tagsFromProps(props: Record<string, unknown> | undefined): string[] {
  return normalizeTags(props?.tags);
}

export function propsWithTags(
  props: Record<string, unknown> | undefined,
  tags: string[],
): Record<string, unknown> {
  return { ...(props ?? {}), tags: normalizeTags(tags) };
}

export function validateTagName(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const name = String(raw ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!name) {
    return { ok: false, error: '标签名不能为空' };
  }
  if (name.length < 2) {
    return { ok: false, error: '标签名至少 2 个字' };
  }
  if (name.length > 16) {
    return { ok: false, error: '标签名最多 16 个字' };
  }
  if (/^[\d\s._\-]+$/.test(name)) {
    return { ok: false, error: '标签名不能全是数字或符号' };
  }
  return { ok: true, value: name };
}

export function validateTagSlug(
  raw: string,
  opts?: { allowEmpty?: boolean },
): { ok: true; value: string } | { ok: false; error: string } {
  const allowEmpty = opts?.allowEmpty !== false;
  const slug = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-\p{Letter}\p{Number}]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  if (!slug) {
    return allowEmpty ? { ok: true, value: '' } : { ok: false, error: '路径别名不能为空' };
  }
  if (/^\d+$/.test(slug)) {
    return { ok: false, error: '路径别名不能全是数字' };
  }
  return { ok: true, value: slug };
}

export function bodyHasBlocks(body: EditorJsDocument): boolean {
  return (body.blocks?.length ?? 0) > 0;
}

export function iso(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  return value instanceof Date ? value.toISOString() : value;
}
