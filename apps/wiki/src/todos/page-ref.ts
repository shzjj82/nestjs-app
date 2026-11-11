import { optionalString, rpcFail } from '@app/common';

const PAGE_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** 待办 / 到期通知共用的页面跳转约定 */
export interface WikiTodoPageRef {
  id: string;
  slug: string;
  title: string;
  appCode: string;
  kind: string;
}

export function requirePageId(raw: unknown): string {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!PAGE_ID.test(value)) {
    rpcFail(400, 'pageId 必填且须为有效文档 id');
  }
  return value;
}

export function asData(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  return raw as Record<string, unknown>;
}

export function isPageRef(raw: unknown): raw is WikiTodoPageRef {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return false;
  }
  const page = raw as Record<string, unknown>;
  return (
    typeof page.id === 'string' &&
    typeof page.slug === 'string' &&
    typeof page.title === 'string' &&
    typeof page.appCode === 'string' &&
    typeof page.kind === 'string'
  );
}

export function pageRefFromPost(post: {
  id: string;
  slug: string;
  title: string;
  appCode: string;
  kind: string;
}): WikiTodoPageRef {
  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    appCode: post.appCode,
    kind: post.kind,
  };
}

/** 把页面引用并入 notify 待办 data，并去掉调用方乱传的 page / pageId */
export function mergeTodoData(
  payloadData: unknown,
  page: WikiTodoPageRef,
  baseData?: Record<string, unknown> | null,
): Record<string, unknown> {
  const rest = { ...(baseData ?? {}), ...(asData(payloadData) ?? {}) };
  const { page: _ignored, pageId: _ignoredId, ...extra } = rest;
  return {
    ...extra,
    pageId: page.id,
    page,
  };
}

export function pageFromTodoData(data: unknown): WikiTodoPageRef | null {
  const record = asData(data);
  return isPageRef(record?.page) ? record.page : null;
}

export function optionalPageId(raw: unknown): string | undefined {
  const value = optionalString(raw);
  return value ? requirePageId(value) : undefined;
}
