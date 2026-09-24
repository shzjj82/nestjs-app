import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { DEFAULT_APP_CODE } from '../common/app-code';
import { rpcFail } from '../common/rpc';
import { CategoryEntity, DocumentEntity } from '../entities';
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
    @InjectRepository(DocumentEntity)
    private readonly posts: Repository<DocumentEntity>,
  ) {}

  toCategory(row: CategoryEntity): Category {
    return {
      id: row.id,
      appCode: row.appCode,
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

  async list(appCode: string): Promise<Category[]> {
    const rows = await this.categories.find({
      where: { appCode },
      order: { sort: 'ASC', createdAt: 'ASC' },
    });
    return rows.map((row) => this.toCategory(row));
  }

  async listSlugs(appCode: string, kind: CategoryKind): Promise<string[]> {
    return (await this.list(appCode))
      .filter((item) => item.kind === kind)
      .map((item) => item.slug);
  }

  async findById(id: string): Promise<Category | null> {
    const row = await this.categories.findOne({ where: { id } });
    return row ? this.toCategory(row) : null;
  }

  async findBySlug(appCode: string, slug: string): Promise<Category | null> {
    const row = await this.categories.findOne({ where: { appCode, slug } });
    return row ? this.toCategory(row) : null;
  }

  async findByName(appCode: string, name: string): Promise<Category | null> {
    const key = name.trim().toLocaleLowerCase();
    if (!key) {
      return null;
    }
    return (
      (await this.list(appCode)).find(
        (item) =>
          item.name.toLocaleLowerCase() === key ||
          item.slug.toLocaleLowerCase() === key,
      ) ?? null
    );
  }

  async resolveExistingSlugs(appCode: string, labels: string[]): Promise<string[]> {
    const out: string[] = [];
    for (const label of normalizeTags(labels)) {
      const existing =
        (await this.findBySlug(appCode, label)) ?? (await this.findByName(appCode, label));
      if (existing) {
        out.push(existing.slug);
      }
    }
    return normalizeTags(out);
  }

  async create(input: {
    appCode: string;
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
    if (await this.findByName(input.appCode, nameCheck.value)) {
      rpcFail(409, 'TAG_NAME_EXISTS');
    }
    const now = new Date();
    const slug = await this.uniqueSlug(input.appCode, slugCheck.value || nameCheck.value);
    let sort = input.sort;
    if (typeof sort !== 'number') {
      const raw = await this.categories
        .createQueryBuilder('c')
        .select('COALESCE(MAX(c.sort), -1)', 'n')
        .where('c.appCode = :appCode', { appCode: input.appCode })
        .getRawOne<{ n: string }>();
      sort = Number(raw?.n ?? -1) + 1;
    }
    const saved = await this.categories.save(
      this.categories.create({
        id: isUuid(input.id) ? input.id : randomUUID(),
        appCode: input.appCode,
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
      appCode?: string;
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
    const appCode = existing.appCode;
    const nameCheck = validateTagName(input.name);
    if (!nameCheck.ok) {
      rpcFail(400, `TAG_NAME_INVALID:${nameCheck.error}`);
    }
    const slugCheck = validateTagSlug(input.slug ?? '', { allowEmpty: true });
    if (!slugCheck.ok) {
      rpcFail(400, `TAG_SLUG_INVALID:${slugCheck.error}`);
    }
    const dup = await this.findByName(appCode, nameCheck.value);
    if (dup && dup.id !== id) {
      rpcFail(409, 'TAG_NAME_EXISTS');
    }
    const oldSlug = existing.slug;
    const slug = await this.uniqueSlug(appCode, slugCheck.value || nameCheck.value, id);
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
      await this.renameSlugOnPosts(appCode, oldSlug, slug);
    }
    return this.findById(id);
  }

  async remove(id: string): Promise<boolean> {
    const existing = await this.findById(id);
    if (!existing) {
      return false;
    }
    await this.detachFromPosts(existing.appCode, existing.slug);
    await this.categories.delete({ id });
    if (!(await this.listSlugs(existing.appCode, 'article')).length) {
      await this.create({
        appCode: existing.appCode,
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

  async ensureDefaults(appCode = DEFAULT_APP_CODE) {
    const count = await this.categories.count({ where: { appCode } });
    if (count > 0) {
      return;
    }
    if (appCode !== DEFAULT_APP_CODE) {
      return;
    }
    const now = new Date();
    await this.categories.save(
      DEFAULT_CATEGORIES.map((item) =>
        this.categories.create({
          id: randomUUID(),
          appCode,
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

  private async uniqueSlug(appCode: string, base: string, excludeId?: string): Promise<string> {
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
      const row = await this.categories.findOne({ where: { appCode, slug } });
      if (!row || row.id === excludeId) {
        return slug;
      }
      slug = `${slugify(base)}-${i}`;
      i += 1;
    }
  }

  private async renameSlugOnPosts(appCode: string, from: string, to: string) {
    const next = await this.findBySlug(appCode, to);
    await this.posts
      .createQueryBuilder()
      .update()
      .set({ category: to, categoryId: next?.id ?? null })
      .where('app_code = :appCode AND category = :from', { appCode, from })
      .execute();
    const rows = await this.posts.find({ where: { appCode } });
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

  private async detachFromPosts(appCode: string, slug: string) {
    const fallback =
      (await this.list(appCode)).find((item) => item.slug !== slug && item.kind === 'article')
        ?.slug ?? 'life';
    const fallbackRow = await this.findBySlug(appCode, fallback);
    const rows = await this.posts.find({ where: { appCode, kind: 'article' } });
    const now = new Date();
    for (const row of rows) {
      const tags = tagsFromProps(row.props);
      const had = tags.includes(slug) || row.category === slug;
      if (!had) {
        continue;
      }
      const nextTags = tags.filter((tag) => tag !== slug);
      const nextSlug =
        row.category === slug
          ? nextTags[0] ?? fallback
          : (await this.findBySlug(appCode, row.category))
            ? row.category
            : nextTags[0] ?? fallback;
      const nextCat = await this.findBySlug(appCode, nextSlug);
      row.category = nextSlug;
      row.categoryId = nextCat?.id ?? fallbackRow?.id ?? null;
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
