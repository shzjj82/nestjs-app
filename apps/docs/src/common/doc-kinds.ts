/**
 * 文档形态。应用隔离用 appCode（blog / kb / …），不要再把产品写进 kind。
 */
export const DOC_KINDS = ['article'] as const;
export type DocKind = (typeof DOC_KINDS)[number];

export type DocKindPolicy = {
  /** 每个 appCode 最多一篇 */
  unique: boolean;
  allowParent: boolean;
  /** 是否允许设为 private（子页强制 public） */
  allowPrivate: boolean;
  allowDelete: boolean;
  allowKindChange: boolean;
  tree: boolean;
  publicBySlug: boolean;
  useCategoryTags: boolean;
  extras: 'none';
};

export const DOC_KIND_POLICIES: Record<DocKind, DocKindPolicy> = {
  article: {
    unique: false,
    allowParent: true,
    allowPrivate: true,
    allowDelete: true,
    allowKindChange: false,
    tree: true,
    publicBySlug: true,
    useCategoryTags: true,
    extras: 'none',
  },
};

export function isDocKind(value: string): value is DocKind {
  return (DOC_KINDS as readonly string[]).includes(value);
}

export function resolveDocKind(value?: string | null): DocKind {
  return value && isDocKind(value) ? value : 'article';
}

export function policyOf(kind: DocKind): DocKindPolicy {
  return DOC_KIND_POLICIES[kind];
}
