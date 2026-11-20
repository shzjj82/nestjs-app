export type AncestorNode = {
  id: string;
  visibility: string;
  authorId: string | null;
  teamId: string | null;
};

/** 从父节点往上走，不包含自己。深度封顶 64。 */
export const ANCESTOR_CHAIN_SQL = `WITH RECURSIVE chain AS (
  SELECT id, parent_id, visibility, author_id, team_id, 1 AS depth
  FROM doc_documents
  WHERE id = (SELECT parent_id FROM doc_documents WHERE id = $1)
  UNION ALL
  SELECT parent.id, parent.parent_id, parent.visibility, parent.author_id, parent.team_id, chain.depth + 1
  FROM doc_documents parent
  INNER JOIN chain ON parent.id = chain.parent_id
  WHERE chain.depth < 64
)
SELECT id, visibility, author_id AS "authorId", team_id AS "teamId"
FROM chain
WHERE id IS NOT NULL
ORDER BY depth ASC`;

/**
 * 是否有不可见的私有祖先。
 * 无 viewerId：任意 private 祖先即不可见。
 * 有 viewerId：仅「private 且非本人、也不在可读团队」的祖先才阻断。
 */
export function privateAncestorBlocks(
  chain: readonly AncestorNode[],
  viewerId?: string,
  readableTeamIds?: readonly string[],
): boolean {
  const teams = new Set(readableTeamIds ?? []);
  return chain.some(
    (node) =>
      node.visibility === 'private' &&
      (!viewerId || node.authorId !== viewerId) &&
      !(node.teamId && teams.has(node.teamId)),
  );
}
