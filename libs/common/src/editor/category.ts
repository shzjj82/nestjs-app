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
