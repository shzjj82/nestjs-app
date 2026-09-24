import { isDocKind, policyOf, type DocKind } from './doc-kinds';

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

/** @deprecated 使用 DocKind；保留别名是为了博客 pageKind 字段 */
export type PageKind = import('./doc-kinds').DocKind;
export type CategoryKind = 'article';
export type SiteSkillColor =
  | 'app-pink'
  | 'purple'
  | 'app-blue'
  | 'app-yellow'
  | 'app-orange'
  | 'app-teal'
  | 'app-green'
  | 'app-red'
  | 'lime-green'
  | 'yellow-green'
  | 'brown'
  | 'warm-peach-pink';

export const SITE_SKILL_COLORS: SiteSkillColor[] = [
  'app-pink',
  'purple',
  'app-blue',
  'app-yellow',
  'app-orange',
  'app-teal',
  'app-green',
  'app-red',
  'lime-green',
  'yellow-green',
  'brown',
  'warm-peach-pink',
];

export const RESERVED_PATHS = [
  'admin',
  'login',
  'post',
  'api',
  'notes',
  'about',
];

export const RESERVED_TAG_NAMES = [
  ...RESERVED_PATHS,
  '笔记',
  '关于',
  '全部',
  '标签',
];

export type Category = {
  id: string;
  appCode: string;
  slug: string;
  name: string;
  hint: string;
  color: SiteSkillColor;
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
  pageKind: PageKind;
  parentId: string | null;
  treeSort: number;
  categoryName: string;
  categoryColor: SiteSkillColor;
  categoryKind: CategoryKind;
  summary: string;
  coverUrl: string;
  props: Record<string, unknown>;
  tags: string[];
  bodyFormat: string;
  authorId: string | null;
  body: EditorJsDocument;
  draft: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DocPostListItem = Omit<DocPost, 'body'>;

export type SiteSkill = { name: string; color: SiteSkillColor };

/** about 文档的额外字段，存在 doc_documents.props 里，不是另一张表 */
export type AboutExtras = {
  avatar: string;
  skills: SiteSkill[];
};

/** 首页 / 关于卡的投影，对应唯一一篇 pageKind=about 的文档 */
export type SiteAbout = {
  name: string;
  body: EditorJsDocument;
  avatar: string;
  skills: SiteSkill[];
};

export const DEFAULT_CATEGORIES: Array<
  Pick<Category, 'slug' | 'name' | 'hint' | 'color' | 'kind' | 'nav' | 'sort'>
> = [
  { slug: 'life', name: '生活', hint: '日常里留下的事', color: 'app-blue', kind: 'article', nav: true, sort: 0 },
  { slug: 'coding', name: '编程', hint: '代码里踩过的坑', color: 'app-green', kind: 'article', nav: true, sort: 1 },
  { slug: 'chat', name: '闲聊', hint: '想到就记一笔', color: 'purple', kind: 'article', nav: true, sort: 2 },
];

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

export const DEFAULT_ABOUT: SiteAbout = {
  name: '小岛日记 · 生活 / 编程 / 闲聊',
  body: normalizeEditorDocument(
    '这是我的个人博客。白天写代码，其余时间看看路、拍拍照，偶尔把卡住的问题和想清楚的事情记下来。',
  ),
  avatar: '',
  skills: [
    { name: 'React / TS', color: 'app-blue' },
    { name: 'Node.js', color: 'app-green' },
    { name: '生活记录', color: 'app-pink' },
    { name: '摄影', color: 'purple' },
    { name: '咖啡', color: 'brown' },
    { name: '散步', color: 'app-teal' },
  ],
};

export function parseSkills(raw: unknown): SiteSkill[] {
  if (typeof raw === 'string') {
    try {
      return parseSkills(JSON.parse(raw));
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return [];
    }
    const row = item as { name?: unknown; color?: unknown };
    if (typeof row.name !== 'string' || typeof row.color !== 'string') {
      return [];
    }
    const name = row.name.trim();
    if (!name || !isSiteSkillColor(row.color)) {
      return [];
    }
    return [{ name, color: row.color }];
  });
}

export function aboutExtrasFromProps(
  props?: Record<string, unknown>,
): AboutExtras {
  const avatar =
    typeof props?.avatar === 'string' && props.avatar.trim()
      ? props.avatar.trim()
      : '';
  const skills = parseSkills(props?.skills);
  return {
    avatar,
    skills: props?.skills === undefined ? DEFAULT_ABOUT.skills : skills,
  };
}

export function propsWithAboutExtras(
  props: Record<string, unknown> | undefined,
  extras?: Partial<AboutExtras>,
): Record<string, unknown> {
  const current = aboutExtrasFromProps(props);
  return {
    ...(props ?? {}),
    avatar: extras?.avatar ?? current.avatar,
    skills: extras?.skills ?? current.skills,
  };
}

export function normalizeKindProps(
  kind: DocKind,
  props?: Record<string, unknown>,
  extras?: Partial<AboutExtras>,
): Record<string, unknown> {
  if (policyOf(kind).extras === 'about') {
    return propsWithAboutExtras(props, extras);
  }
  return { ...(props ?? {}) };
}

export function aboutFromPost(post: {
  title: string;
  body: EditorJsDocument | unknown;
  props: Record<string, unknown>;
}): SiteAbout {
  const extras = aboutExtrasFromProps(post.props);
  return {
    name: post.title || DEFAULT_ABOUT.name,
    body: normalizeEditorDocument(post.body),
    avatar: extras.avatar || DEFAULT_ABOUT.avatar,
    skills: extras.skills,
  };
}

export { DOC_KINDS, isDocKind, policyOf, resolveDocKind } from './doc-kinds';
export type { DocKind, DocKindPolicy } from './doc-kinds';

export function isPageKind(value: string): value is PageKind {
  return isDocKind(value);
}

export function isCategoryKind(value: string): value is CategoryKind {
  return value === 'article';
}

export function isSiteSkillColor(value: string): value is SiteSkillColor {
  return (SITE_SKILL_COLORS as string[]).includes(value);
}

export function isReservedPath(slug: string): boolean {
  return RESERVED_PATHS.includes(slug);
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
    return { ok: false, error: '先写标签名。' };
  }
  if (name.length < 2) {
    return { ok: false, error: '标签名至少 2 个字。' };
  }
  if (name.length > 16) {
    return { ok: false, error: '标签名最多 16 个字。' };
  }
  if (/^[\d\s._\-]+$/.test(name)) {
    return { ok: false, error: '标签名不能全是数字或符号。' };
  }
  if (RESERVED_TAG_NAMES.some((item) => item.toLocaleLowerCase() === name.toLocaleLowerCase())) {
    return { ok: false, error: '这个名字是系统保留的，换一个吧。' };
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
    return allowEmpty ? { ok: true, value: '' } : { ok: false, error: '路径别名不能为空。' };
  }
  if (isReservedPath(slug)) {
    return { ok: false, error: '这个路径是系统保留的，换一个吧。' };
  }
  if (/^\d+$/.test(slug)) {
    return { ok: false, error: '路径别名不能全是数字。' };
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
