import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, Repository, type SelectQueryBuilder } from 'typeorm';
import { CategoriesService } from '../categories/categories.service';
import { rpcFail } from '../common/rpc';
import { resolveDocKind, type DocKind } from '../common/doc-kinds';
import {
  bodyHasBlocks,
  normalizeEditorDocument,
  propsWithTags,
  starterArticleDocument,
  tagsFromProps,
  type Category,
  type CategoryKind,
  type DocPost,
  type DocPostListItem,
  type EditorJsDocument,
} from '../common/shared';
import { DocumentEntity } from '../entities';
import type { DocVisibility } from './list-scope';

type WriteInput = {
  appCode: string;
  id?: string;
  title: string;
  slug?: string;
  type: string;
  kind?: DocKind;
  parentId?: string | null;
  treeSort?: number;
  summary: string;
  coverUrl: string;
  props?: Record<string, unknown>;
  tags?: string[];
  body: EditorJsDocument;
  visibility?: DocVisibility;
  authorId?: string | null;
  teamId?: string | null;
};

type VisibilityFilter = 'public-only' | 'feed' | 'any';

const LIST_COLUMNS = [
  'post.id',
  'post.appCode',
  'post.slug',
  'post.title',
  'post.kind',
  'post.category',
  'post.categoryId',
  'post.parentId',
  'post.treeSort',
  'post.summary',
  'post.coverUrl',
  'post.props',
  'post.bodyFormat',
  'post.authorId',
  'post.teamId',
  'post.visibility',
  'post.publishedAt',
  'post.createdAt',
  'post.updatedAt',
];

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(DocumentEntity)
    private readonly posts: Repository<DocumentEntity>,
    private readonly categories: CategoriesService,
    private readonly dataSource: DataSource,
  ) {}

  async toPost(row: DocumentEntity): Promise<DocPost> {
    const categories = await this.categoryIndex(row.appCode);
    return {
      ...this.toListItem(row, categories),
      body: normalizeEditorDocument(row.body),
    };
  }

  private toListItem(
    row: DocumentEntity,
    categories: Map<string, Category>,
  ): DocPostListItem {
    const category = row.category ? categories.get(row.category) : undefined;
    const props = row.props ?? {};
    const fromProps = tagsFromProps(props);
    return {
      id: row.id,
      appCode: row.appCode,
      slug: row.slug,
      title: row.title,
      type: row.category,
      kind: resolveDocKind(row.kind),
      parentId: row.parentId,
      treeSort: row.treeSort,
      categoryName: category?.name ?? row.category,
      categoryColor: category?.color ?? '',
      categoryKind: category?.kind === 'article' ? 'article' : 'article',
      summary: row.summary,
      coverUrl: row.coverUrl,
      props: { ...props },
      tags: fromProps.length > 0 ? fromProps : row.category ? [row.category] : [],
      bodyFormat: row.bodyFormat || 'editorjs',
      authorId: row.authorId ?? null,
      teamId: row.teamId ?? null,
      visibility: row.visibility === 'public' ? 'public' : 'private',
      publishedAt: row.publishedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async categoryIndex(appCode: string): Promise<Map<string, Category>> {
    const rows = await this.categories.list(appCode);
    return new Map(rows.map((item) => [item.slug, item]));
  }

  private async mapList(appCode: string, rows: DocumentEntity[]): Promise<DocPostListItem[]> {
    if (!rows.length) {
      return [];
    }
    const categories = await this.categoryIndex(appCode);
    return rows.map((row) => this.toListItem(row, categories));
  }

  async list(opts: {
    appCode: string;
    type?: string;
    kind?: CategoryKind;
    docKind?: DocKind;
    parentId?: string | null;
    limit?: number;
    page?: number;
    pageSize?: number;
    visibilityFilter: VisibilityFilter;
    /** feed：公开文 + 当前用户自己的私有文 + 所在团队的私有文 */
    viewerId?: string;
    readableTeamIds?: string[];
    treeOrder?: boolean;
    /** 按作者过滤文章 */
    authorId?: string;
    /** workspace：本人文章 + 无作者旧文（可认领） */
    authorScopedWorkspace?: boolean;
  }): Promise<{ posts: DocPostListItem[]; total: number }> {
    const qb = this.posts.createQueryBuilder('post');
    qb.andWhere('post.appCode = :appCode', { appCode: opts.appCode });
    if (opts.authorScopedWorkspace && opts.authorId) {
      // authorId 为空的是接多用户前写的旧文，工作区暂时可见，编辑时会认领
      if (opts.readableTeamIds?.length) {
        qb.andWhere(
          `(post.author_id = :authorId OR post.author_id IS NULL OR post.team_id IN (:...readableTeamIds))`,
          { authorId: opts.authorId, readableTeamIds: opts.readableTeamIds },
        );
      } else {
        qb.andWhere(`(post.author_id = :authorId OR post.author_id IS NULL)`, {
          authorId: opts.authorId,
        });
      }
    } else if (opts.authorId) {
      qb.andWhere('post.authorId = :authorId', { authorId: opts.authorId });
    }
    this.applyVisibility(qb, opts.visibilityFilter, opts.viewerId, opts.readableTeamIds);
    if (opts.docKind) {
      qb.andWhere('post.kind = :docKind', { docKind: opts.docKind });
    }
    if (opts.parentId !== undefined) {
      if (opts.parentId === null) {
        qb.andWhere('post.parentId IS NULL');
      } else {
        qb.andWhere('post.parentId = :parentId', { parentId: opts.parentId });
      }
    }
    if (opts.type) {
      if (!(await this.categories.findBySlug(opts.appCode, opts.type))) {
        return { posts: [], total: 0 };
      }
      if (!opts.docKind) {
        qb.andWhere("post.kind = 'article'");
      }
      qb.andWhere(
        `(post.category = :typeSlug OR jsonb_exists(COALESCE(post.props, '{}'::jsonb) -> 'tags', :typeSlug))`,
        { typeSlug: opts.type },
      );
    } else if (opts.kind && !opts.docKind) {
      const slugs = await this.categories.listSlugs(opts.appCode, opts.kind);
      if (!slugs.length) {
        return { posts: [], total: 0 };
      }
      qb.andWhere('post.category IN (:...slugs)', { slugs });
      if (opts.kind === 'article') {
        qb.andWhere("post.kind = 'article'");
      }
    }
    const filtered = qb.clone();
    qb.select(LIST_COLUMNS).addSelect('COUNT(*) OVER()', 'full_count');
    if (opts.treeOrder) {
      qb.orderBy('post.treeSort', 'ASC').addOrderBy('post.createdAt', 'ASC');
    } else {
      qb
        .orderBy('post.publishedAt', 'DESC', 'NULLS LAST')
        .addOrderBy('post.createdAt', 'DESC');
    }
    let offset = 0;
    if (opts.pageSize && opts.pageSize > 0) {
      const pageSize = Math.min(Math.floor(opts.pageSize), 100);
      const page = Math.max(1, Math.floor(opts.page ?? 1));
      offset = (page - 1) * pageSize;
      qb.take(pageSize).skip(offset);
    } else if (opts.limit && opts.limit > 0) {
      qb.take(Math.min(opts.limit, 100));
    }
    const { entities, raw } = await qb.getRawAndEntities();
    let total = entities.length ? Number(raw[0]?.full_count ?? entities.length) : 0;
    if (!entities.length && offset > 0) {
      total = await filtered.getCount();
    }
    return {
      posts: await this.mapList(opts.appCode, entities),
      total,
    };
  }

  async listWorkspaceTree(
    appCode: string,
    authorId?: string,
    readableTeamIds?: string[],
  ): Promise<DocPostListItem[]> {
    const { posts } = await this.list({
      appCode,
      visibilityFilter: 'any',
      treeOrder: true,
      authorId,
      authorScopedWorkspace: Boolean(authorId),
      readableTeamIds,
    });
    return posts;
  }

  /**
   * 公开列表去掉私有节点及其子孙。CTE 不关联外层行，一条 SQL 只算一次。
   * feed 且带查看者时，查看者自己的私有文仍保留。
   */
  private applyVisibility(
    qb: SelectQueryBuilder<DocumentEntity>,
    filter: VisibilityFilter,
    viewerId?: string,
    readableTeamIds?: string[],
  ) {
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

  /**
   * 文章仅作者（或尚无 authorId 的旧数据）可改。
   * 无 actorId 时放行：仅服务密钥迁移/运维路径应走到这里；用户 JWT 路径必有 actorId。
   */
  assertArticleOwner(
    post: DocPost,
    actorId: string | undefined,
    writableTeamIds?: readonly string[],
  ): void {
    if (!actorId) {
      return;
    }
    if (!post.authorId || post.authorId === actorId) {
      return;
    }
    if (post.teamId && writableTeamIds?.includes(post.teamId)) {
      return;
    }
    rpcFail(403, 'FORBIDDEN');
  }

  async findBySlug(
    appCode: string,
    slug: string,
    opts: { mode: 'public' | 'feed' | 'any'; viewerId?: string; readableTeamIds?: string[] },
  ): Promise<DocPost | null> {
    const row = await this.posts.findOne({ where: { appCode, slug } });
    if (!row) {
      return null;
    }
    const post = await this.toPost(row);
    if (opts.mode === 'any') {
      return post;
    }
    if (opts.mode === 'public') {
      if (post.visibility !== 'public' || (await this.hasPrivateAncestor(post.id))) {
        return null;
      }
      return post;
    }
    // feed：私有仅本人可见；祖先私有且非本人则不可见
    const inTeam = Boolean(post.teamId && opts.readableTeamIds?.includes(post.teamId));
    const visible = Boolean(opts.viewerId && post.authorId === opts.viewerId) || inTeam;
    if (post.visibility === 'private' && !visible) {
      return null;
    }
    if (await this.hasPrivateAncestor(post.id, opts.viewerId, opts.readableTeamIds)) {
      return null;
    }
    return post;
  }

  async findById(id: string): Promise<DocPost | null> {
    const row = await this.posts.findOne({ where: { id } });
    return row ? this.toPost(row) : null;
  }

  async listAncestors(
    postId: string,
    includePrivate: boolean,
  ): Promise<DocPostListItem[]> {
    const chain = await this.ancestorChain(postId);
    const ids: string[] = [];
    for (const node of chain) {
      if (!includePrivate && node.visibility === 'private') {
        break;
      }
      ids.push(node.id);
    }
    if (!ids.length) {
      return [];
    }
    const rows = await this.posts
      .createQueryBuilder('post')
      .select(LIST_COLUMNS)
      .where('post.id IN (:...ids)', { ids })
      .getMany();
    const appCode = rows[0]?.appCode;
    if (!appCode) {
      return [];
    }
    const items = await this.mapList(appCode, rows);
    const byId = new Map(items.map((item) => [item.id, item]));
    return [...ids].reverse().flatMap((id) => {
      const item = byId.get(id);
      return item ? [item] : [];
    });
  }

  async create(input: WriteInput): Promise<DocPost> {
    const appCode = input.appCode;
    const docKind = resolveDocKind(input.kind);
    const parentId = await this.resolveParent(appCode, input.parentId);
    const visibility = this.resolveVisibility(parentId, input.visibility);
    const rawTags =
      input.tags !== undefined
        ? tagsFromProps(propsWithTags({}, input.tags))
        : tagsFromProps(input.props);
    const tagSlugs = parentId
      ? rawTags
      : await this.categories.resolveExistingSlugs(appCode, rawTags);
    const fallbackType = '';
    const resolvedType = parentId
      ? input.type || fallbackType
      : tagSlugs[0] && (await this.categories.findBySlug(appCode, tagSlugs[0]))
        ? tagSlugs[0]
        : ((await this.categories.findBySlug(appCode, input.type))?.slug ?? fallbackType);
    const categoryRow = await this.categories.findBySlug(appCode, resolvedType);
    const now = new Date();
    const id = isUuid(input.id) ? input.id : randomUUID();
    const slug = await this.uniqueSlug(appCode, input.slug || input.title || docKind);
    const props = parentId
      ? input.tags !== undefined
        ? propsWithTags(input.props, input.tags)
        : { ...(input.props ?? {}) }
      : propsWithTags(input.props, tagSlugs);
    await this.posts.save(
      this.posts.create({
        id,
        appCode,
        slug,
        title: input.title,
        kind: docKind,
        category: resolvedType,
        categoryId: categoryRow?.id ?? null,
        parentId,
        treeSort:
          typeof input.treeSort === 'number'
            ? input.treeSort
            : await this.nextTreeSort(appCode, parentId, docKind),
        summary: input.summary,
        coverUrl: input.coverUrl,
        props,
        bodyFormat: 'editorjs',
        body: input.body as unknown as Record<string, unknown>,
        authorId: input.authorId ?? null,
        teamId: input.teamId ?? null,
        visibility,
        publishedAt: visibility === 'public' ? now : null,
        createdAt: now,
        updatedAt: now,
      }),
    );
    const created = await this.findById(id);
    if (!created) {
      rpcFail(500, 'SERVER_ERROR');
    }
    return created;
  }

  async update(
    id: string,
    input: WriteInput,
    writableTeamIds?: readonly string[],
  ): Promise<DocPost | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }
    this.assertArticleOwner(existing, input.authorId ?? undefined, writableTeamIds);
    // 旧文无作者时，首次由当前用户认领
    if (!existing.authorId && input.authorId) {
      existing.authorId = input.authorId;
    }
    const appCode = existing.appCode;
    const docKind = resolveDocKind(input.kind ?? existing.kind);
    let parentId = existing.parentId;
    if (input.parentId !== undefined) {
      parentId = await this.resolveParent(appCode, input.parentId);
      if (parentId && (await this.wouldCreateCycle(id, parentId))) {
        rpcFail(400, 'INVALID_PARENT');
      }
    }
    const visibility = this.resolveVisibility(
      parentId,
      input.visibility ?? existing.visibility,
    );
    if (!bodyHasBlocks(input.body) && bodyHasBlocks(existing.body)) {
      rpcFail(400, 'EMPTY_BODY');
    }
    const now = new Date();
    let publishedAt = existing.publishedAt ? new Date(existing.publishedAt) : null;
    if (visibility === 'public') {
      if (!publishedAt) {
        publishedAt = now;
      }
    } else {
      publishedAt = null;
    }
    const baseProps = input.props ?? existing.props;
    const rawTags =
      input.tags !== undefined
        ? tagsFromProps(propsWithTags({}, input.tags))
        : tagsFromProps(baseProps);
    const tagSlugs = parentId
      ? rawTags
      : await this.categories.resolveExistingSlugs(appCode, rawTags);
    const props = parentId
      ? input.tags !== undefined
        ? propsWithTags(baseProps, input.tags)
        : { ...baseProps }
      : propsWithTags(baseProps, tagSlugs);
    const fallbackType = existing.type || '';
    const resolvedType = parentId
      ? input.type || fallbackType
      : tagSlugs[0] && (await this.categories.findBySlug(appCode, tagSlugs[0]))
        ? tagSlugs[0]
        : ((await this.categories.findBySlug(appCode, input.type))?.slug ?? fallbackType);
    const categoryRow = await this.categories.findBySlug(appCode, resolvedType);
    await this.posts.update(
      { id },
      {
        slug: await this.uniqueSlug(appCode, input.slug || input.title || existing.slug, id),
        title: input.title,
        kind: docKind,
        category: resolvedType,
        categoryId: categoryRow?.id ?? null,
        parentId,
        treeSort:
          typeof input.treeSort === 'number' ? input.treeSort : existing.treeSort,
        summary: input.summary,
        coverUrl: input.coverUrl,
        props: props as never,
        body: input.body as never,
        authorId: existing.authorId ?? input.authorId ?? null,
        ...(input.teamId !== undefined ? { teamId: input.teamId } : {}),
        visibility,
        publishedAt,
        updatedAt: now,
      },
    );
    return this.findById(id);
  }

  async createLinkedChild(
    parentId: string,
    authorId?: string,
    writableTeamIds?: readonly string[],
  ) {
    return this.dataSource.transaction(async () => {
      const parent = await this.findById(parentId);
      if (!parent) {
        rpcFail(400, 'INVALID_PARENT');
      }
      this.assertArticleOwner(parent, authorId, writableTeamIds);
      const child = await this.create({
        appCode: parent.appCode,
        title: '无标题',
        type: parent.type,
        kind: parent.kind,
        parentId,
        summary: '',
        coverUrl: '',
        body: starterArticleDocument(),
        visibility: 'public',
        authorId: authorId ?? parent.authorId ?? null,
        teamId: parent.teamId,
      });
      const nextParent = await this.appendPageLink(parentId, child);
      if (!nextParent) {
        rpcFail(400, 'INVALID_PARENT');
      }
      return { post: child, parent: nextParent };
    });
  }

  async reparent(
    childId: string,
    newParentId: string | null,
    actorId?: string,
    writableTeamIds?: readonly string[],
  ) {
    return this.dataSource.transaction(async () => {
      const child = await this.findById(childId);
      if (!child) {
        rpcFail(404, 'NOT_FOUND');
      }
      this.assertArticleOwner(child, actorId, writableTeamIds);
      if (newParentId) {
        const parent = await this.findById(newParentId);
        if (parent) {
          this.assertArticleOwner(parent, actorId, writableTeamIds);
        }
      }
      const resolvedParentId = await this.resolveParent(child.appCode, newParentId);
      if (resolvedParentId && (await this.wouldCreateCycle(childId, resolvedParentId))) {
        rpcFail(400, 'INVALID_PARENT');
      }
      if ((child.parentId ?? null) === resolvedParentId) {
        return {
          child,
          oldParent: child.parentId ? await this.findById(child.parentId) : null,
          newParent: resolvedParentId ? await this.findById(resolvedParentId) : null,
        };
      }
      const oldParentId = child.parentId;
      if (oldParentId) {
        await this.stripPageLink(oldParentId, childId);
      }
      const now = new Date();
      const visibility: DocVisibility = resolvedParentId ? 'public' : child.visibility;
      let publishedAt = child.publishedAt ? new Date(child.publishedAt) : null;
      if (visibility === 'public') {
        if (!publishedAt) {
          publishedAt = now;
        }
      } else {
        publishedAt = null;
      }
      await this.posts.update(
        { id: childId },
        {
          parentId: resolvedParentId,
          treeSort: await this.nextTreeSort(child.appCode, resolvedParentId, 'article'),
          visibility,
          publishedAt,
          updatedAt: now,
        },
      );
      const updatedChild = await this.findById(childId);
      if (!updatedChild) {
        rpcFail(404, 'NOT_FOUND');
      }
      let newParent = null;
      if (resolvedParentId) {
        newParent = await this.appendPageLink(resolvedParentId, updatedChild);
      }
      return {
        child: updatedChild,
        oldParent: oldParentId ? await this.findById(oldParentId) : null,
        newParent,
      };
    });
  }

  async remove(
    id: string,
    actorId?: string,
    writableTeamIds?: readonly string[],
  ): Promise<boolean> {
    return this.dataSource.transaction(async () => {
      const existing = await this.findById(id);
      if (!existing) {
        return false;
      }
      this.assertArticleOwner(existing, actorId, writableTeamIds);
      const ids = await this.collectSubtree(id);
      if (existing.parentId) {
        await this.stripPageLink(existing.parentId, id);
      }
      for (const itemId of [...ids].reverse()) {
        await this.posts.delete({ id: itemId });
      }
      return true;
    });
  }

  private resolveVisibility(parentId: string | null, input?: DocVisibility): DocVisibility {
    if (parentId) {
      return 'public';
    }
    return input ?? 'private';
  }

  private async collectSubtree(rootId: string): Promise<string[]> {
    const kids = await this.posts.find({ where: { parentId: rootId } });
    const nested = await Promise.all(kids.map((kid) => this.collectSubtree(kid.id)));
    return [rootId, ...nested.flat()];
  }

  private async appendPageLink(
    parentId: string,
    child: Pick<DocPost, 'id' | 'slug' | 'title'>,
  ) {
    const parent = await this.findById(parentId);
    if (!parent) {
      return null;
    }
    const blocks = [...(parent.body.blocks ?? [])];
    if (
      blocks.some(
        (block) =>
          block.type === 'pageLink' &&
          String(block.data.pageId ?? '') === child.id,
      )
    ) {
      return parent;
    }
    const title = child.title?.trim() && child.title !== '无标题' ? child.title : '无标题';
    parent.body = {
      ...parent.body,
      time: Date.now(),
      blocks: [
        ...blocks,
        { type: 'pageLink', data: { pageId: child.id, slug: child.slug, title } },
      ],
    };
    await this.posts.update(
      { id: parentId },
      {
        body: parent.body as never,
        updatedAt: new Date(),
      },
    );
    return this.findById(parentId);
  }

  private async stripPageLink(parentId: string, childId: string) {
    const parent = await this.findById(parentId);
    if (!parent) {
      return;
    }
    const blocks = parent.body.blocks ?? [];
    const next = blocks.filter(
      (block) =>
        !(block.type === 'pageLink' && String(block.data.pageId ?? '') === childId),
    );
    if (next.length === blocks.length) {
      return;
    }
    await this.posts.update(
      { id: parentId },
      {
        body: { ...parent.body, time: Date.now(), blocks: next } as never,
        updatedAt: new Date(),
      },
    );
  }

  private async resolveParent(appCode: string, parentId: string | null | undefined) {
    if (!parentId) {
      return null;
    }
    const parent = await this.findById(parentId);
    if (!parent || parent.appCode !== appCode) {
      rpcFail(400, 'INVALID_PARENT');
    }
    return parent.id;
  }

  private async wouldCreateCycle(pageId: string, newParentId: string) {
    if (pageId === newParentId) {
      return true;
    }
    let current: string | null = newParentId;
    const seen = new Set<string>();
    while (current) {
      if (current === pageId || seen.has(current)) {
        return true;
      }
      seen.add(current);
      const row = await this.posts.findOne({ where: { id: current } });
      current = row?.parentId ?? null;
    }
    return false;
  }

  private async uniqueSlug(appCode: string, base: string, excludeId?: string): Promise<string> {
    const slugify = (input: string) => {
      const value = input
        .trim()
        .toLowerCase()
        .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);
      return value || randomUUID().slice(0, 8);
    };
    let slug = slugify(base);
    let i = 2;
    for (;;) {
      const row = await this.posts.findOne({ where: { appCode, slug } });
      if (!row || row.id === excludeId) {
        return slug;
      }
      slug = `${slugify(base)}-${i}`;
      i += 1;
    }
  }

  private async nextTreeSort(appCode: string, parentId: string | null, docKind?: DocKind) {
    const qb = this.posts
      .createQueryBuilder('post')
      .select('COALESCE(MAX(post.treeSort), -1)', 'n')
      .andWhere('post.appCode = :appCode', { appCode });
    if (parentId) {
      qb.andWhere('post.parentId = :parentId', { parentId });
    } else {
      qb.andWhere('post.kind = :docKind AND post.parentId IS NULL', {
        docKind: docKind ?? 'article',
      });
    }
    const raw = await qb.getRawOne<{ n: string }>();
    return Number(raw?.n ?? -1) + 1;
  }

  private async ancestorChain(postId: string): Promise<
    Array<{ id: string; visibility: string; authorId: string | null; teamId: string | null }>
  > {
    return this.posts.query(
      `WITH RECURSIVE chain AS (
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
       ORDER BY depth ASC`,
      [postId],
    );
  }

  /**
   * 是否有不可见的私有祖先。
   * 无 viewerId：任意 private 祖先即不可见。
   * 有 viewerId：仅「private 且非本人」的祖先才阻断。
   */
  private async hasPrivateAncestor(
    postId: string,
    viewerId?: string,
    readableTeamIds?: readonly string[],
  ) {
    const chain = await this.ancestorChain(postId);
    const teams = new Set(readableTeamIds ?? []);
    return chain.some(
      (node) =>
        node.visibility === 'private' &&
        (!viewerId || node.authorId !== viewerId) &&
        !(node.teamId && teams.has(node.teamId)),
    );
  }
}

function isUuid(value?: string): value is string {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        value,
      ),
  );
}
