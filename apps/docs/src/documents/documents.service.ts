import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { DEFAULT_APP_CODE } from '../common/app-code';
import { CategoriesService } from '../categories/categories.service';
import { rpcFail } from '../common/rpc';
import { policyOf, resolveDocKind, type DocKind } from '../common/doc-kinds';
import {
  DEFAULT_ABOUT,
  bodyHasBlocks,
  normalizeEditorDocument,
  normalizeKindProps,
  propsWithTags,
  starterArticleDocument,
  tagsFromProps,
  type CategoryKind,
  type DocPost,
  type DocPostListItem,
  type EditorJsDocument,
} from '../common/shared';
import { DocumentEntity } from '../entities';

type WriteInput = {
  appCode: string;
  id?: string;
  title: string;
  slug?: string;
  type: string;
  pageKind?: DocKind;
  parentId?: string | null;
  treeSort?: number;
  summary: string;
  coverUrl: string;
  props?: Record<string, unknown>;
  tags?: string[];
  body: EditorJsDocument;
  draft: boolean;
  authorId?: string | null;
};

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(DocumentEntity)
    private readonly posts: Repository<DocumentEntity>,
    private readonly categories: CategoriesService,
    private readonly dataSource: DataSource,
  ) {}

  async toPost(row: DocumentEntity): Promise<DocPost> {
    const pageKind = resolveDocKind(row.kind);
    const policy = policyOf(pageKind);
    const props = row.props ?? {};
    const fromProps = tagsFromProps(props);
    const tags =
      fromProps.length > 0
        ? fromProps
        : row.category && policy.useCategoryTags
          ? [row.category]
          : [];
    const category = await this.categories.findBySlug(row.appCode, row.category);
    const normalizedProps = normalizeKindProps(pageKind, props);
    return {
      id: row.id,
      appCode: row.appCode,
      slug: row.slug,
      title: row.title,
      type: row.category,
      pageKind,
      parentId: row.parentId,
      treeSort: row.treeSort,
      categoryName: category?.name ?? row.category,
      categoryColor: category?.color ?? 'app-yellow',
      categoryKind: category?.kind ?? 'article',
      summary: row.summary,
      coverUrl: row.coverUrl,
      props: normalizedProps,
      tags,
      bodyFormat: row.bodyFormat || 'editorjs',
      authorId: row.authorId ?? null,
      body: normalizeEditorDocument(row.body),
      draft: row.draft,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async toListItem(row: DocumentEntity): Promise<DocPostListItem> {
    const { body: _body, ...item } = await this.toPost(row);
    return item;
  }

  async list(opts: {
    appCode: string;
    type?: string;
    kind?: CategoryKind;
    pageKind?: DocKind;
    parentId?: string | null;
    limit?: number;
    page?: number;
    pageSize?: number;
    includeDrafts: boolean;
    treeOrder?: boolean;
  }): Promise<{ posts: DocPostListItem[]; total: number }> {
    const qb = this.posts.createQueryBuilder('post');
    qb.andWhere('post.appCode = :appCode', { appCode: opts.appCode });
    if (!opts.includeDrafts) {
      qb.andWhere('post.draft = false');
      qb.andWhere(`post.id NOT IN (
        WITH RECURSIVE under_draft AS (
          SELECT id FROM doc_documents WHERE draft = true AND app_code = :appCode
          UNION ALL
          SELECT p.id FROM doc_documents p INNER JOIN under_draft u ON p.parent_id = u.id
          WHERE p.app_code = :appCode
        )
        SELECT id FROM under_draft
      )`);
    }
    if (opts.pageKind) {
      qb.andWhere('post.kind = :pageKind', { pageKind: opts.pageKind });
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
      if (!opts.pageKind) {
        qb.andWhere("post.kind = 'article'");
      }
      qb.andWhere(
        `(post.category = :typeSlug OR jsonb_exists(COALESCE(post.props, '{}'::jsonb) -> 'tags', :typeSlug))`,
        { typeSlug: opts.type },
      );
    } else if (opts.kind && !opts.pageKind) {
      const slugs = await this.categories.listSlugs(opts.appCode, opts.kind);
      if (!slugs.length) {
        return { posts: [], total: 0 };
      }
      qb.andWhere('post.category IN (:...slugs)', { slugs });
      if (opts.kind === 'article') {
        qb.andWhere("post.kind = 'article'");
      }
    }
    const total = await qb.clone().getCount();
    if (opts.treeOrder) {
      qb.orderBy('post.treeSort', 'ASC').addOrderBy('post.createdAt', 'ASC');
    } else {
      qb
        .orderBy('post.publishedAt', 'DESC', 'NULLS LAST')
        .addOrderBy('post.createdAt', 'DESC');
    }
    if (opts.pageSize && opts.pageSize > 0) {
      const pageSize = Math.min(Math.floor(opts.pageSize), 100);
      const page = Math.max(1, Math.floor(opts.page ?? 1));
      qb.take(pageSize).skip((page - 1) * pageSize);
    } else if (opts.limit && opts.limit > 0) {
      qb.take(Math.min(opts.limit, 100));
    }
    const rows = await qb.getMany();
    return {
      posts: await Promise.all(rows.map((row) => this.toListItem(row))),
      total,
    };
  }

  async listWorkspaceTree(appCode: string, includeDrafts: boolean): Promise<DocPostListItem[]> {
    const { posts } = await this.list({ appCode, includeDrafts, treeOrder: true });
    return posts.filter((item) => policyOf(item.pageKind).tree);
  }

  async findBySlug(
    appCode: string,
    slug: string,
    includeDrafts: boolean,
  ): Promise<DocPost | null> {
    const row = await this.posts.findOne({ where: { appCode, slug } });
    if (!row) {
      return null;
    }
    const post = await this.toPost(row);
    if (!includeDrafts && (post.draft || (await this.hasDraftAncestor(post.id)))) {
      return null;
    }
    return post;
  }

  async findById(id: string): Promise<DocPost | null> {
    const row = await this.posts.findOne({ where: { id } });
    return row ? this.toPost(row) : null;
  }

  async findByKind(appCode: string, pageKind: DocKind): Promise<DocPost | null> {
    const row = await this.posts.findOne({ where: { appCode, kind: pageKind } });
    return row ? this.toPost(row) : null;
  }

  async listAncestors(postId: string, includeDrafts: boolean): Promise<DocPostListItem[]> {
    const index = await this.loadAncestorIndex();
    const chainIds: string[] = [];
    let current = index.get(postId)?.parentId ?? null;
    const seen = new Set<string>();
    while (current) {
      if (seen.has(current)) {
        break;
      }
      seen.add(current);
      const parent = index.get(current);
      if (!parent) {
        break;
      }
      if (!includeDrafts && parent.draft) {
        break;
      }
      chainIds.unshift(current);
      current = parent.parentId;
    }
    if (!chainIds.length) {
      return [];
    }
    const rows = await this.posts
      .createQueryBuilder('post')
      .where('post.id IN (:...ids)', { ids: chainIds })
      .getMany();
    const byId = new Map(
      await Promise.all(
        rows.map(async (row) => [row.id, await this.toListItem(row)] as const),
      ),
    );
    return chainIds.flatMap((id) => {
      const item = byId.get(id);
      return item ? [item] : [];
    });
  }

  async create(input: WriteInput): Promise<DocPost> {
    const appCode = input.appCode;
    const pageKind = resolveDocKind(input.pageKind);
    const policy = policyOf(pageKind);
    if (policy.unique && (await this.findByKind(appCode, pageKind))) {
      rpcFail(409, 'PAGE_EXISTS');
    }
    let parentId: string | null = null;
    if (policy.allowParent) {
      parentId = await this.resolveParent(appCode, input.parentId);
    }
    const asDraft = !policy.allowDraft || parentId ? false : Boolean(input.draft);
    const rawTags =
      input.tags !== undefined
        ? tagsFromProps(propsWithTags({}, input.tags))
        : tagsFromProps(input.props);
    const tagSlugs =
      policy.useCategoryTags && !parentId
        ? await this.categories.resolveExistingSlugs(appCode, rawTags)
        : rawTags;
    const cats = await this.categories.list(appCode);
    const fallbackType = cats.find((item) => item.kind === 'article')?.slug ?? 'life';
    const resolvedType = policy.useCategoryTags
      ? (tagSlugs[0] && (await this.categories.findBySlug(appCode, tagSlugs[0]))
          ? tagSlugs[0]
          : ((await this.categories.findBySlug(appCode, input.type))?.slug ?? fallbackType))
      : input.type || fallbackType;
    const categoryRow = await this.categories.findBySlug(appCode, resolvedType);
    const now = new Date();
    const id = isUuid(input.id) ? input.id : randomUUID();
    const slug = await this.uniqueSlug(appCode, input.slug || input.title || pageKind);
    const props = policy.useCategoryTags && !parentId
      ? propsWithTags(normalizeKindProps(pageKind, input.props), tagSlugs)
      : normalizeKindProps(
          pageKind,
          input.tags !== undefined
            ? propsWithTags(input.props, input.tags)
            : input.props,
        );
    await this.posts.save(
      this.posts.create({
        id,
        appCode,
        slug,
        title: input.title,
        kind: pageKind,
        category: resolvedType,
        categoryId: categoryRow?.id ?? null,
        parentId,
        treeSort:
          typeof input.treeSort === 'number'
            ? input.treeSort
            : await this.nextTreeSort(appCode, parentId, pageKind),
        summary: input.summary,
        coverUrl: input.coverUrl,
        props,
        bodyFormat: 'editorjs',
        body: input.body as unknown as Record<string, unknown>,
        authorId: input.authorId ?? null,
        draft: asDraft,
        publishedAt: asDraft ? null : now,
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

  async update(id: string, input: WriteInput): Promise<DocPost | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }
    const appCode = existing.appCode;
    const pageKind = resolveDocKind(input.pageKind ?? existing.pageKind);
    const policy = policyOf(pageKind);
    if (
      existing.pageKind !== pageKind &&
      !policyOf(existing.pageKind).allowKindChange
    ) {
      rpcFail(400, 'PAGE_KIND_FIXED');
    }
    let parentId = existing.parentId;
    if (!policy.allowParent) {
      parentId = null;
    } else if (input.parentId !== undefined) {
      parentId = await this.resolveParent(appCode, input.parentId);
      if (parentId && (await this.wouldCreateCycle(id, parentId))) {
        rpcFail(400, 'INVALID_PARENT');
      }
    }
    const asDraft = !policy.allowDraft || parentId ? false : Boolean(input.draft);
    if (!bodyHasBlocks(input.body) && bodyHasBlocks(existing.body)) {
      rpcFail(400, 'EMPTY_BODY');
    }
    const now = new Date();
    let publishedAt = existing.publishedAt ? new Date(existing.publishedAt) : null;
    if (!asDraft && !publishedAt) {
      publishedAt = now;
    }
    const baseProps = input.props ?? existing.props;
    const rawTags =
      input.tags !== undefined
        ? tagsFromProps(propsWithTags({}, input.tags))
        : tagsFromProps(baseProps);
    const tagSlugs =
      policy.useCategoryTags && !parentId
        ? await this.categories.resolveExistingSlugs(appCode, rawTags)
        : rawTags;
    const props =
      policy.useCategoryTags && !parentId
        ? propsWithTags(normalizeKindProps(pageKind, baseProps), tagSlugs)
        : normalizeKindProps(
            pageKind,
            input.tags !== undefined
              ? propsWithTags(baseProps, input.tags)
              : baseProps,
          );
    const cats = await this.categories.list(appCode);
    const fallbackType =
      existing.type || cats.find((item) => item.kind === 'article')?.slug || 'life';
    const resolvedType = policy.useCategoryTags
      ? (tagSlugs[0] && (await this.categories.findBySlug(appCode, tagSlugs[0]))
          ? tagSlugs[0]
          : ((await this.categories.findBySlug(appCode, input.type))?.slug ?? fallbackType))
      : input.type || fallbackType;
    const categoryRow = await this.categories.findBySlug(appCode, resolvedType);
    await this.posts.update(
      { id },
      {
        slug: await this.uniqueSlug(appCode, input.slug || input.title || existing.slug, id),
        title: input.title,
        kind: pageKind,
        category: resolvedType,
        categoryId: categoryRow?.id ?? null,
        parentId,
        treeSort:
          typeof input.treeSort === 'number' ? input.treeSort : existing.treeSort,
        summary: input.summary,
        coverUrl: input.coverUrl,
        props: props as never,
        body: input.body as never,
        authorId: input.authorId ?? existing.authorId,
        draft: asDraft,
        publishedAt,
        updatedAt: now,
      },
    );
    return this.findById(id);
  }

  async createLinkedChild(parentId: string) {
    return this.dataSource.transaction(async () => {
      const parent = await this.findById(parentId);
      if (!parent || !policyOf(parent.pageKind).allowParent) {
        rpcFail(400, 'INVALID_PARENT');
      }
      const child = await this.create({
        appCode: parent.appCode,
        title: '无标题',
        type: parent.type,
        pageKind: parent.pageKind,
        parentId,
        summary: '',
        coverUrl: '',
        body: starterArticleDocument(),
        draft: false,
      });
      const nextParent = await this.appendPageLink(parentId, child);
      if (!nextParent) {
        rpcFail(400, 'INVALID_PARENT');
      }
      return { post: child, parent: nextParent };
    });
  }

  async reparent(childId: string, newParentId: string | null) {
    return this.dataSource.transaction(async () => {
      const child = await this.findById(childId);
      if (!child || !policyOf(child.pageKind).allowParent) {
        rpcFail(404, 'NOT_FOUND');
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
      const asDraft = resolvedParentId ? false : child.draft;
      let publishedAt = child.publishedAt ? new Date(child.publishedAt) : null;
      if (!asDraft && !publishedAt) {
        publishedAt = now;
      }
      await this.posts.update(
        { id: childId },
        {
          parentId: resolvedParentId,
          treeSort: await this.nextTreeSort(child.appCode, resolvedParentId, 'article'),
          draft: asDraft,
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

  async remove(id: string): Promise<boolean> {
    return this.dataSource.transaction(async () => {
      const existing = await this.findById(id);
      if (!existing) {
        return false;
      }
      if (!policyOf(existing.pageKind).allowDelete) {
        rpcFail(400, 'PAGE_FIXED');
      }
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

  async ensureAboutPage(appCode = DEFAULT_APP_CODE): Promise<DocPost> {
    const existing = await this.findByKind(appCode, 'about');
    if (existing) {
      return existing;
    }
    const cats = await this.categories.list(appCode);
    return this.create({
      appCode,
      title: DEFAULT_ABOUT.name,
      slug: `sys-about-${randomUUID().slice(0, 8)}`,
      type: cats.find((item) => item.kind === 'article')?.slug ?? 'life',
      pageKind: 'about',
      summary: '',
      coverUrl: '',
      body: DEFAULT_ABOUT.body,
      draft: false,
      treeSort: -1,
      props: {
        avatar: DEFAULT_ABOUT.avatar,
        skills: DEFAULT_ABOUT.skills,
      },
    });
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
    if (!parent || !policyOf(parent.pageKind).allowParent) {
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
    if (!parent || parent.appCode !== appCode || !policyOf(parent.pageKind).allowParent) {
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

  private async nextTreeSort(appCode: string, parentId: string | null, pageKind?: DocKind) {
    const qb = this.posts
      .createQueryBuilder('post')
      .select('COALESCE(MAX(post.treeSort), -1)', 'n')
      .andWhere('post.appCode = :appCode', { appCode });
    if (parentId) {
      qb.andWhere('post.parentId = :parentId', { parentId });
    } else if (pageKind && policyOf(pageKind).allowParent) {
      qb.andWhere('post.kind = :pageKind AND post.parentId IS NULL', { pageKind });
    } else {
      return 0;
    }
    const raw = await qb.getRawOne<{ n: string }>();
    return Number(raw?.n ?? -1) + 1;
  }

  private async loadAncestorIndex() {
    const rows = await this.posts.find({
      select: { id: true, parentId: true, draft: true },
    });
    return new Map(rows.map((row) => [row.id, row]));
  }

  private async hasDraftAncestor(postId: string) {
    const index = await this.loadAncestorIndex();
    let current = index.get(postId)?.parentId ?? null;
    const seen = new Set<string>();
    while (current) {
      if (seen.has(current)) {
        break;
      }
      seen.add(current);
      const parent = index.get(current);
      if (!parent) {
        break;
      }
      if (parent.draft) {
        return true;
      }
      current = parent.parentId;
    }
    return false;
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
