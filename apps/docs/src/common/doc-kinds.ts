/**
 * 文档形态。应用隔离用 appCode（blog / kb / …），不要再把产品写进 kind。
 */
export const DOC_KINDS = ['article', 'about'] as const;
export type DocKind = (typeof DOC_KINDS)[number];

export type DocKindPolicy = {
  /** 每个 appCode 最多一篇，如 about */
  unique: boolean;
  allowParent: boolean;
  allowDraft: boolean;
  allowDelete: boolean;
  allowKindChange: boolean;
  tree: boolean;
  publicBySlug: boolean;
  useCategoryTags: boolean;
  extras: 'none' | 'about';
};

export const DOC_KIND_POLICIES: Record<DocKind, DocKindPolicy> = {
  article: {
    unique: false,
    allowParent: true,
    allowDraft: true,
    allowDelete: true,
    allowKindChange: false,
    tree: true,
    publicBySlug: true,
    useCategoryTags: true,
    extras: 'none',
  },
  about: {
    unique: true,
    allowParent: false,
    allowDraft: false,
    allowDelete: false,
    allowKindChange: false,
    tree: true,
    publicBySlug: false,
    useCategoryTags: false,
    extras: 'about',
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
