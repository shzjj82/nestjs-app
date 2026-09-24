import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { CategoriesService } from '../categories/categories.service';
import { rpcFail } from '../common/rpc';
import { PostEntity } from '../entities';
import { SiteService } from '../site/site.service';
import {
  bodyHasBlocks,
  isPageKind,
  normalizeEditorDocument,
  propsWithTags,
  starterArticleDocument,
  tagsFromProps,
  type CategoryKind,
  type DocPost,
  type DocPostListItem,
  type EditorJsDocument,
  type PageKind,
} from '../common/shared';

type WriteInput = {
  id?: string;
  title: string;
  slug?: string;
  type: string;
  pageKind?: PageKind;
  parentId?: string | null;
  treeSort?: number;
  summary: string;
  coverUrl: string;
  props?: Record<string, unknown>;
  tags?: string[];
  body: EditorJsDocument;
  draft: boolean;
};

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(PostEntity)
    private readonly posts: Repository<PostEntity>,
    private readonly categories: CategoriesService,
    private readonly site: SiteService,
    private readonly dataSource: DataSource,
  ) {}

  async toPost(row: PostEntity): Promise<DocPost> {
    const pageKind = isPageKind(row.pageKind) ? row.pageKind : 'article';
    const props = row.props ?? {};
    const fromProps = tagsFromProps(props);
    const tags =
      fromProps.length > 0
        ? fromProps
        : row.type && pageKind === 'article'
          ? [row.type]
          : [];
    const category = await this.categories.findBySlug(row.type);
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      type: row.type,
      pageKind,
      parentId: row.parentId,
      treeSort: row.treeSort,
      categoryName: category?.name ?? row.type,
      categoryColor: category?.color ?? 'app-yellow',
      categoryKind: category?.kind ?? 'article',
      summary: row.summary,
      coverUrl: row.coverUrl,
      props,
      tags,
      body: normalizeEditorDocument(row.body),
      draft: row.draft,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async toListItem(row: PostEntity): Promise<DocPostListItem> {
    const { body: _body, ...item } = await this.toPost(row);
    return item;
  }

  async list(opts: {
    type?: string;
    kind?: CategoryKind;
    pageKind?: PageKind;
    parentId?: string | null;
    limit?: number;
    page?: number;
    pageSize?: number;
    includeDrafts: boolean;
    treeOrder?: boolean;
  }): Promise<{ posts: DocPostListItem[]; total: number }> {
    const qb = this.posts.createQueryBuilder('post');
    if (!opts.includeDrafts) {
      qb.andWhere('post.draft = false');
      qb.andWhere(`post.id NOT IN (
        WITH RECURSIVE under_draft AS (
          SELECT id FROM doc_posts WHERE draft = true
          UNION ALL
          SELECT p.id FROM doc_posts p INNER JOIN under_draft u ON p.parent_id = u.id
        )
        SELECT id FROM under_draft
      )`);
    }
    if (opts.pageKind) {
      qb.andWhere('post.pageKind = :pageKind', { pageKind: opts.pageKind });
    }
    if (opts.parentId !== undefined) {
      if (opts.parentId === null) {
        qb.andWhere('post.parentId IS NULL');
      } else {
        qb.andWhere('post.parentId = :parentId', { parentId: opts.parentId });
      }
    }
    if (opts.type) {
      if (!(await this.categories.findBySlug(opts.type))) {
        return { posts: [], total: 0 };
      }
      if (!opts.pageKind) {
        qb.andWhere("post.pageKind = 'article'");
      }
      qb.andWhere(
        `(post.type = :typeSlug OR jsonb_exists(COALESCE(post.props, '{}'::jsonb) -> 'tags', :typeSlug))`,
        { typeSlug: opts.type },
      );
    } else if (opts.kind && !opts.pageKind) {
      const slugs = await this.categories.listSlugs(opts.kind);
      if (!slugs.length) {
        return { posts: [], total: 0 };
      }
      qb.andWhere('post.type IN (:...slugs)', { slugs });
      if (opts.kind === 'article') {
        qb.andWhere("post.pageKind = 'article'");
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

  async listWorkspaceTree(includeDrafts: boolean): Promise<DocPostListItem[]> {
    const { posts } = await this.list({ includeDrafts, treeOrder: true });
    return posts.filter((item) => item.pageKind === 'about' || item.pageKind === 'article');
  }

  async findBySlug(slug: string, includeDrafts: boolean): Promise<DocPost | null> {
    const row = await this.posts.findOne({ where: { slug } });
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

  async findByKind(pageKind: PageKind): Promise<DocPost | null> {
    const row = await this.posts.findOne({ where: { pageKind } });
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
    const pageKind = input.pageKind ?? 'article';
    if (pageKind === 'about' && (await this.findByKind('about'))) {
      rpcFail(409, 'PAGE_EXISTS');
    }
    let parentId: string | null = null;
    if (pageKind === 'article') {
      parentId = await this.resolveArticleParent(input.parentId);
    }
    const asDraft = parentId ? false : Boolean(input.draft);
    const rawTags =
      input.tags !== undefined
        ? tagsFromProps(propsWithTags({}, input.tags))
        : tagsFromProps(input.props);
    const tagSlugs =
      pageKind === 'article' && !parentId
        ? await this.categories.resolveExistingSlugs(rawTags)
        : rawTags;
    const cats = await this.categories.list();
    const resolvedType =
      pageKind === 'article'
        ? (tagSlugs[0] && (await this.categories.findBySlug(tagSlugs[0]))
            ? tagSlugs[0]
            : ((await this.categories.findBySlug(input.type))?.slug ??
              cats.find((item) => item.kind === 'article')?.slug ??
              'life'))
        : input.type || cats.find((item) => item.kind === 'article')?.slug || 'life';
    const now = new Date();
    const id = isUuid(input.id) ? input.id : randomUUID();
    const slug = await this.uniqueSlug(input.slug || input.title || pageKind);
    const props =
      pageKind === 'article' && !parentId
        ? propsWithTags(input.props, tagSlugs)
        : input.tags !== undefined
          ? propsWithTags(input.props, input.tags)
          : propsWithTags(input.props, tagsFromProps(input.props));
    await this.posts.save(
      this.posts.create({
        id,
        slug,
        title: input.title,
        type: resolvedType,
        pageKind,
        parentId,
        treeSort:
          typeof input.treeSort === 'number'
            ? input.treeSort
            : await this.nextTreeSort(parentId, pageKind),
        summary: input.summary,
        coverUrl: input.coverUrl,
        props,
        body: input.body as unknown as Record<string, unknown>,
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
    if (created.pageKind === 'about') {
      await this.site.syncFromAboutPage(created);
    }
    return created;
  }

  async update(id: string, input: WriteInput): Promise<DocPost | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }
    const pageKind = input.pageKind ?? existing.pageKind;
    if (existing.pageKind === 'about' && pageKind !== existing.pageKind) {
      rpcFail(400, 'PAGE_KIND_FIXED');
    }
    let parentId = existing.parentId;
    if (pageKind === 'article') {
      if (input.parentId !== undefined) {
        parentId = await this.resolveArticleParent(input.parentId);
        if (parentId && (await this.wouldCreateCycle(id, parentId))) {
          rpcFail(400, 'INVALID_PARENT');
        }
      }
    } else {
      parentId = null;
    }
    const asDraft = parentId ? false : Boolean(input.draft);
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
      pageKind === 'article' && !parentId
        ? await this.categories.resolveExistingSlugs(rawTags)
        : rawTags;
    const props =
      pageKind === 'article' && !parentId
        ? propsWithTags(baseProps, tagSlugs)
        : input.tags !== undefined
          ? propsWithTags(baseProps, input.tags)
          : propsWithTags(baseProps, tagsFromProps(baseProps));
    const cats = await this.categories.list();
    const resolvedType =
      pageKind === 'article'
        ? (tagSlugs[0] && (await this.categories.findBySlug(tagSlugs[0]))
            ? tagSlugs[0]
            : ((await this.categories.findBySlug(input.type))?.slug ??
              existing.type ??
              cats.find((item) => item.kind === 'article')?.slug ??
              'life'))
        : input.type;
    await this.posts.update(
      { id },
      {
        slug: await this.uniqueSlug(input.slug || input.title || existing.slug, id),
        title: input.title,
        type: resolvedType,
        pageKind,
        parentId,
        treeSort:
          typeof input.treeSort === 'number' ? input.treeSort : existing.treeSort,
        summary: input.summary,
        coverUrl: input.coverUrl,
        props: props as never,
        body: input.body as never,
        draft: asDraft,
        publishedAt,
        updatedAt: now,
      },
    );
    const updated = await this.findById(id);
    if (updated?.pageKind === 'about') {
      await this.site.syncFromAboutPage(updated);
    }
    return updated;
  }

  async createLinkedChild(parentId: string) {
    return this.dataSource.transaction(async () => {
      const parent = await this.findById(parentId);
      if (!parent || parent.pageKind !== 'article') {
        rpcFail(400, 'INVALID_PARENT');
      }
      const child = await this.create({
        title: '无标题',
        type: parent.type,
        pageKind: 'article',
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
      if (!child || child.pageKind !== 'article') {
        rpcFail(404, 'NOT_FOUND');
      }
      const resolvedParentId = await this.resolveArticleParent(newParentId);
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
          treeSort: await this.nextTreeSort(resolvedParentId, 'article'),
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
      if (existing.pageKind === 'about') {
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

  async ensureAboutPage() {
    if (await this.findByKind('about')) {
      return;
    }
    const cats = await this.categories.list();
    const about = await this.site.getAbout();
    await this.create({
      title: about.name,
      slug: `sys-about-${randomUUID().slice(0, 8)}`,
      type: cats.find((item) => item.kind === 'article')?.slug ?? 'life',
      pageKind: 'about',
      summary: '',
      coverUrl: '',
      body: about.body,
      draft: false,
      treeSort: -1,
      props: { avatar: about.avatar, skills: about.skills },
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
    if (!parent || parent.pageKind !== 'article') {
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

  private async resolveArticleParent(parentId: string | null | undefined) {
    if (!parentId) {
      return null;
    }
    const parent = await this.findById(parentId);
    if (!parent || parent.pageKind !== 'article') {
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

  private async uniqueSlug(base: string, excludeId?: string): Promise<string> {
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
      const row = await this.posts.findOne({ where: { slug } });
      if (!row || row.id === excludeId) {
        return slug;
      }
      slug = `${slugify(base)}-${i}`;
      i += 1;
    }
  }

  private async nextTreeSort(parentId: string | null, pageKind?: PageKind) {
    const qb = this.posts
      .createQueryBuilder('post')
      .select('COALESCE(MAX(post.treeSort), -1)', 'n');
    if (parentId) {
      qb.where('post.parentId = :parentId', { parentId });
    } else if (pageKind === 'article') {
      qb.where("post.pageKind = 'article' AND post.parentId IS NULL");
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
