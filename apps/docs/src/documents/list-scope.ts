/**
 * 列表查询意图（通用原语，与具体产品无关）：
 * - public：仅 visibility=public；结果不因 JWT 而变（适合 SSR 缓存）
 * - feed：公开文 + 当前用户自己的私有文；有会话时混入，无会话等同 public
 * - mine：当前用户工作区（全部可见性）；必须用户会话，禁止仅靠服务密钥
 * - all：运维/迁移全量；需特权（docs-key 或已登录特权上下文）
 */
export type DocsListScope = 'public' | 'feed' | 'mine' | 'all';

export type DocVisibility = 'private' | 'public';

export function resolveDocsListScope(payload: {
  scope?: unknown;
  tree?: unknown;
}): DocsListScope {
  const raw = typeof payload.scope === 'string' ? payload.scope.trim().toLowerCase() : '';
  if (raw === 'public' || raw === 'feed' || raw === 'mine' || raw === 'all') {
    return raw;
  }
  const tree =
    payload.tree === '1' || payload.tree === true || payload.tree === 'true';
  // 兼容旧契约：tree=1 即工作区「我的」树
  return tree ? 'mine' : 'public';
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
  // 短暂兼容旧 draft 字段
  if (raw === false || raw === 'false' || raw === 0 || raw === '0') {
    return 'public';
  }
  if (raw === true || raw === 'true' || raw === 1 || raw === '1') {
    return 'private';
  }
  return fallback;
}
