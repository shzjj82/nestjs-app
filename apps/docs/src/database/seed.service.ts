import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DEFAULT_APP_CODE } from '../common/app-code';
import { CategoriesService } from '../categories/categories.service';
import { DocumentsService } from '../documents/documents.service';
import { dropLegacySharedDocTables, openSharedDatabase } from './ensure-database';

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger('DocsSeed');

  constructor(
    private readonly categories: CategoriesService,
    private readonly posts: DocumentsService,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit() {
    await this.copyFromSharedDatabase();
    const local = await this.dataSource.query(
      `SELECT count(*)::int AS n FROM doc_documents`,
    );
    if (Number(local[0]?.n ?? 0) > 0) {
      await dropLegacySharedDocTables(this.logger);
    }
    await this.categories.ensureDefaults(DEFAULT_APP_CODE);
    await this.posts.ensureAboutPage(DEFAULT_APP_CODE);
    this.logger.log(`文档服务已就绪：appCode=${DEFAULT_APP_CODE}`);
  }

  private async copyFromSharedDatabase() {
    const local = await this.dataSource.query(
      `SELECT count(*)::int AS n FROM doc_documents`,
    );
    if (Number(local[0]?.n ?? 0) > 0) {
      return;
    }
    const src = await openSharedDatabase();
    if (!src) {
      return;
    }
    try {
      const exists = await src.query(
        `SELECT to_regclass('public.doc_documents') AS name`,
      );
      if (!exists[0]?.name) {
        return;
      }
      const remote = await src.query(`SELECT count(*)::int AS n FROM doc_documents`);
      if (Number(remote[0]?.n ?? 0) === 0) {
        return;
      }
      const cats = await src.query(`SELECT * FROM doc_categories`);
      for (const row of cats) {
        await this.dataSource.query(
          `INSERT INTO doc_categories
            (id, app_code, slug, name, hint, color, kind, nav, sort, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT (id) DO NOTHING`,
          [
            row.id,
            row.app_code ?? DEFAULT_APP_CODE,
            row.slug,
            row.name,
            row.hint ?? '',
            row.color,
            row.kind ?? 'article',
            row.nav ?? true,
            row.sort ?? 0,
            row.created_at,
            row.updated_at,
          ],
        );
      }
      const docs = await src.query(`SELECT * FROM doc_documents`);
      for (const row of docs) {
        await this.dataSource.query(
          `INSERT INTO doc_documents
            (id, app_code, slug, title, kind, category, category_id, parent_id, tree_sort,
             summary, cover_url, props, body_format, body, draft, published_at, author_id,
             created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,NULL,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
           ON CONFLICT (id) DO NOTHING`,
          [
            row.id,
            row.app_code ?? DEFAULT_APP_CODE,
            row.slug,
            row.title,
            row.kind === 'kb' ? 'article' : (row.kind ?? 'article'),
            row.category ?? '',
            row.category_id ?? null,
            row.tree_sort ?? 0,
            row.summary ?? '',
            row.cover_url ?? '',
            row.props ?? {},
            row.body_format ?? 'editorjs',
            row.body ?? { time: Date.now(), version: '2.30.7', blocks: [] },
            row.draft ?? true,
            row.published_at ?? null,
            row.author_id ?? null,
            row.created_at,
            row.updated_at,
          ],
        );
      }
      for (const row of docs) {
        if (!row.parent_id) {
          continue;
        }
        await this.dataSource.query(
          `UPDATE doc_documents SET parent_id = $2 WHERE id = $1`,
          [row.id, row.parent_id],
        );
      }
      this.logger.log(`已从共享库迁入分类 ${cats.length}、文档 ${docs.length}`);
    } finally {
      await src.destroy();
    }
  }
}
