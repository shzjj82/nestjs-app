/**
 * 列表查询意图（通用原语，与具体产品无关）：
 * - public：仅 visibility=public；结果不因 JWT 而变（适合 SSR 缓存）
 * - feed：公开文 + 当前用户自己的私有文；有会话时混入，无会话等同 public
 * - mine：当前用户工作区（全部可见性）；必须用户会话，禁止仅靠服务密钥
 * - all：运维/迁移全量；必须带文档服务密钥
 */
export type DocsListScope = 'public' | 'feed' | 'mine' | 'all';

export type DocVisibility = 'private' | 'public';

export function resolveDocsListScope(payload: {
  scope?: unknown;
}): DocsListScope {
  const raw = typeof payload.scope === 'string' ? payload.scope.trim().toLowerCase() : '';
  if (raw === 'public' || raw === 'feed' || raw === 'mine' || raw === 'all') {
    return raw;
  }
  return 'public';
}

export function isTreeView(payload: { tree?: unknown; view?: unknown }): boolean {
  return (
    payload.tree === '1' ||
    payload.tree === true ||
    payload.tree === 'true' ||
    payload.view === 'tree'
  );
}

export function parseVisibility(raw: unknown, fallback: DocVisibility = 'private'): DocVisibility {
  if (raw === 'public' || raw === 'private') {
    return raw;
  }
  return fallback;
}
