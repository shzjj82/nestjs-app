/**
 * 文档形态。目前只有 article，应用之间用 appCode 隔离。
 */
export const DOC_KINDS = ['article'] as const;
export type DocKind = (typeof DOC_KINDS)[number];

export function isDocKind(value: string): value is DocKind {
  return (DOC_KINDS as readonly string[]).includes(value);
}

export function resolveDocKind(value?: string | null): DocKind {
  return value && isDocKind(value) ? value : 'article';
}
