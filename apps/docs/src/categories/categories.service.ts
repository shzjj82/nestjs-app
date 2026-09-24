import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { rpcFail } from '../common/rpc';
import { CategoryEntity, PostEntity } from '../entities';
import {
  DEFAULT_CATEGORIES,
  SITE_SKILL_COLORS,
  isReservedPath,
  normalizeTags,
  propsWithTags,
  tagsFromProps,
  validateTagName,
  validateTagSlug,
  type Category,
  type CategoryKind,
  type SiteSkillColor,
} from '../common/shared';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(CategoryEntity)
    private readonly categories: Repository<CategoryEntity>,
    @InjectRepository(PostEntity)
    private readonly posts: Repository<PostEntity>,
  ) {}

  toCategory(row: CategoryEntity): Category {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      hint: row.hint,
      color: (this.isColor(row.color) ? row.color : 'app-yellow') as SiteSkillColor,
      kind: row.kind === 'article' ? 'article' : 'article',
      nav: row.nav,
      sort: row.sort,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async list(): Promise<Category[]> {
    const rows = await this.categories.find({
      order: { sort: 'ASC', createdAt: 'ASC' },
    });
    return rows.map((row) => this.toCategory(row));
  }

  async listSlugs(kind: CategoryKind): Promise<string[]> {
    return (await this.list())
      .filter((item) => item.kind === kind)
      .map((item) => item.slug);
  }

  async findById(id: string): Promise<Category | null> {
    const row = await this.categories.findOne({ where: { id } });
    return row ? this.toCategory(row) : null;
  }

  async findBySlug(slug: string): Promise<Category | null> {
    const row = await this.categories.findOne({ where: { slug } });
    return row ? this.toCategory(row) : null;
  }

  async findByName(name: string): Promise<Category | null> {
    const key = name.trim().toLocaleLowerCase();
    if (!key) {
      return null;
    }
    return (
      (await this.list()).find(
        (item) =>
          item.name.toLocaleLowerCase() === key ||
          item.slug.toLocaleLowerCase() === key,
      ) ?? null
    );
  }

  async resolveExistingSlugs(labels: string[]): Promise<string[]> {
    const out: string[] = [];
    for (const label of normalizeTags(labels)) {
      const existing =
        (await this.findBySlug(label)) ?? (await this.findByName(label));
      if (existing) {
        out.push(existing.slug);
      }
    }
    return normalizeTags(out);
  }

  async create(input: {
    id?: string;
    name: string;
    slug?: string;
    hint?: string;
    color: string;
    kind: CategoryKind;
    nav?: boolean;
    sort?: number;
  }): Promise<Category> {
    const nameCheck = validateTagName(input.name);
    if (!nameCheck.ok) {
      rpcFail(400, `TAG_NAME_INVALID:${nameCheck.error}`);
    }
    const slugCheck = validateTagSlug(input.slug ?? '', { allowEmpty: true });
    if (!slugCheck.ok) {
      rpcFail(400, `TAG_SLUG_INVALID:${slugCheck.error}`);
    }
    if (await this.findByName(nameCheck.value)) {
      rpcFail(409, 'TAG_NAME_EXISTS');
    }
    const now = new Date();
    const slug = await this.uniqueSlug(slugCheck.value || nameCheck.value);
    let sort = input.sort;
    if (typeof sort !== 'number') {
      const raw = await this.categories
        .createQueryBuilder('c')
        .select('COALESCE(MAX(c.sort), -1)', 'n')
        .where('c.kind = :kind', { kind: 'article' })
        .getRawOne<{ n: string }>();
      sort = Number(raw?.n ?? -1) + 1;
    }
    const saved = await this.categories.save(
      this.categories.create({
        id: isUuid(input.id) ? input.id : randomUUID(),
        slug,
        name: nameCheck.value,
        hint: input.hint?.trim() ?? '',
        color: input.color,
        kind: input.kind,
        nav: input.nav !== false,
        sort,
        createdAt: now,
        updatedAt: now,
      }),
    );
    return this.toCategory(saved);
  }

  async update(
    id: string,
    input: {
      name: string;
      slug?: string;
      hint?: string;
      color: string;
      kind: CategoryKind;
      nav?: boolean;
      sort?: number;
    },
  ): Promise<Category | null> {
    const existing = await this.categories.findOne({ where: { id } });
    if (!existing) {
      return null;
    }
    const nameCheck = validateTagName(input.name);
    if (!nameCheck.ok) {
      rpcFail(400, `TAG_NAME_INVALID:${nameCheck.error}`);
    }
    const slugCheck = validateTagSlug(input.slug ?? '', { allowEmpty: true });
    if (!slugCheck.ok) {
      rpcFail(400, `TAG_SLUG_INVALID:${slugCheck.error}`);
    }
    const dup = await this.findByName(nameCheck.value);
    if (dup && dup.id !== id) {
      rpcFail(409, 'TAG_NAME_EXISTS');
    }
    const oldSlug = existing.slug;
    const slug = await this.uniqueSlug(slugCheck.value || nameCheck.value, id);
    existing.slug = slug;
    existing.name = nameCheck.value;
    existing.hint = input.hint?.trim() ?? '';
    existing.color = input.color;
    existing.kind = input.kind;
    existing.nav = input.nav !== false;
    existing.sort = typeof input.sort === 'number' ? input.sort : existing.sort;
    existing.updatedAt = new Date();
    await this.categories.save(existing);
    if (slug !== oldSlug) {
      await this.renameSlugOnPosts(oldSlug, slug);
    }
    return this.findById(id);
  }

  async remove(id: string): Promise<boolean> {
    const existing = await this.findById(id);
    if (!existing) {
      return false;
    }
    await this.detachFromPosts(existing.slug);
    await this.categories.delete({ id });
    if (!(await this.listSlugs('article')).length) {
      await this.create({
        name: '未分类',
        slug: 'uncategorized',
        hint: '还没归类的笔记',
        color: SITE_SKILL_COLORS[0],
        kind: 'article',
        nav: false,
      });
    }
    return true;
  }

  async ensureDefaults() {
    const count = await this.categories.count();
    if (count > 0) {
      return;
    }
    const now = new Date();
    await this.categories.save(
      DEFAULT_CATEGORIES.map((item) =>
        this.categories.create({
          id: randomUUID(),
          slug: item.slug,
          name: item.name,
          hint: item.hint,
          color: item.color,
          kind: item.kind,
          nav: item.nav,
          sort: item.sort,
          createdAt: now,
          updatedAt: now,
        }),
      ),
    );
  }

  private async uniqueSlug(base: string, excludeId?: string): Promise<string> {
    const slugify = (input: string) => {
      const value = input
        .trim()
        .toLowerCase()
        .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40);
      return value || randomUUID().slice(0, 8);
    };
    let slug = slugify(base);
    let i = 2;
    for (;;) {
      if (isReservedPath(slug)) {
        slug = `${slugify(base)}-${i}`;
        i += 1;
        continue;
      }
      const row = await this.categories.findOne({ where: { slug } });
      if (!row || row.id === excludeId) {
        return slug;
      }
      slug = `${slugify(base)}-${i}`;
      i += 1;
    }
  }

  private async renameSlugOnPosts(from: string, to: string) {
    await this.posts
      .createQueryBuilder()
      .update()
      .set({ type: to })
      .where('type = :from', { from })
      .execute();
    const rows = await this.posts.find();
    for (const row of rows) {
      const tags = tagsFromProps(row.props);
      if (!tags.includes(from)) {
        continue;
      }
      row.props = propsWithTags(
        row.props,
        tags.map((tag) => (tag === from ? to : tag)),
      );
      row.updatedAt = new Date();
      await this.posts.save(row);
    }
  }

  private async detachFromPosts(slug: string) {
    const fallback =
      (await this.list()).find((item) => item.slug !== slug && item.kind === 'article')
        ?.slug ?? 'life';
    const rows = await this.posts.find({ where: { pageKind: 'article' } });
    const now = new Date();
    for (const row of rows) {
      const tags = tagsFromProps(row.props);
      const had = tags.includes(slug) || row.type === slug;
      if (!had) {
        continue;
      }
      const nextTags = tags.filter((tag) => tag !== slug);
      row.type =
        row.type === slug
          ? nextTags[0] ?? fallback
          : (await this.findBySlug(row.type))
            ? row.type
            : nextTags[0] ?? fallback;
      row.props = propsWithTags(row.props, nextTags);
      row.updatedAt = now;
      await this.posts.save(row);
    }
  }

  private isColor(value: string): boolean {
    return SITE_SKILL_COLORS.includes(value as SiteSkillColor);
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
