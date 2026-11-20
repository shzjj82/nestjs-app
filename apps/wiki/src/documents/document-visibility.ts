import type { SelectQueryBuilder } from 'typeorm';
import type { DocumentEntity } from '../entities';

export type VisibilityFilter = 'public-only' | 'feed' | 'any';

/**
 * 工作区：作者自己的、还没作者的旧文，以及团队根和它的子孙。
 * 子树用一条不关联外层行的递归，深度封顶 64，避免环和逐行递归。
 */
export function applyWorkspaceAuthor(
  qb: SelectQueryBuilder<DocumentEntity>,
  authorId: string,
  readableTeamIds?: string[],
): void {
  if (readableTeamIds?.length) {
    qb.andWhere(
      `(post.author_id = :authorId OR post.author_id IS NULL OR post.id IN (
        WITH RECURSIVE team_tree AS (
          SELECT id, 0 AS depth FROM doc_documents
          WHERE app_code = :appCode AND team_id IN (:...readableTeamIds)
          UNION ALL
          SELECT child.id, parent.depth + 1 FROM doc_documents child
          INNER JOIN team_tree parent ON child.parent_id = parent.id
          WHERE child.app_code = :appCode AND parent.depth < 64
        )
        SELECT id FROM team_tree
      ))`,
      { authorId, readableTeamIds },
    );
    return;
  }
  qb.andWhere(`(post.author_id = :authorId OR post.author_id IS NULL)`, { authorId });
}

/**
 * 公开列表去掉私有节点及其子孙。CTE 不关联外层行，一条 SQL 只算一次。
 * feed 且带查看者时，查看者自己的私有文、以及所在团队的私有文仍保留。
 * id 是主键，NOT IN 不会遇到 NULL。
 */
export function applyDocumentVisibility(
  qb: SelectQueryBuilder<DocumentEntity>,
  filter: VisibilityFilter,
  viewerId?: string,
  readableTeamIds?: string[],
): void {
  if (filter === 'any') {
    return;
  }
  const teamIds = readableTeamIds?.length ? readableTeamIds : [];
  const ownedFeed = filter === 'feed' && !!viewerId;
  if (ownedFeed) {
    const teamSql = teamIds.length ? ` OR post.team_id IN (:...readableTeamIds)` : '';
    qb.andWhere(
      `(post.visibility = 'public' OR (post.visibility = 'private' AND (post.author_id = :viewerId${teamSql})))`,
      teamIds.length ? { viewerId, readableTeamIds: teamIds } : { viewerId },
    );
    const hiddenTeamSql = teamIds.length
      ? `AND (team_id IS NULL OR team_id NOT IN (:...readableTeamIds))`
      : '';
    qb.andWhere(
      `post.id NOT IN (
        WITH RECURSIVE under_hidden AS (
          SELECT id, 0 AS depth FROM doc_documents
          WHERE visibility = 'private'
            AND author_id IS DISTINCT FROM :viewerId
            AND app_code = :appCode
            ${hiddenTeamSql}
          UNION ALL
          SELECT child.id, parent.depth + 1 FROM doc_documents child
          INNER JOIN under_hidden parent ON child.parent_id = parent.id
          WHERE child.app_code = :appCode AND parent.depth < 64
        )
        SELECT id FROM under_hidden
      )`,
      teamIds.length ? { viewerId, readableTeamIds: teamIds } : { viewerId },
    );
    return;
  }
  qb.andWhere(`post.visibility = 'public'`);
  qb.andWhere(
    `post.id NOT IN (
      WITH RECURSIVE under_private AS (
        SELECT id, 0 AS depth FROM doc_documents
        WHERE visibility = 'private' AND app_code = :appCode
        UNION ALL
        SELECT child.id, parent.depth + 1 FROM doc_documents child
        INNER JOIN under_private parent ON child.parent_id = parent.id
        WHERE child.app_code = :appCode AND parent.depth < 64
      )
      SELECT id FROM under_private
    )`,
  );
}
