import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { dropLegacySharedDocTables, openSharedDatabase } from './ensure-database';

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger('DocsSeed');

  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit() {
    await this.copyFromSharedDatabase();
    await this.copyTeamsFromUsercenter();
    const local = await this.dataSource.query(
      `SELECT count(*)::int AS n FROM doc_documents`,
    );
    if (Number(local[0]?.n ?? 0) > 0) {
      await dropLegacySharedDocTables(this.logger);
    }
    this.logger.log('文档服务已就绪');
  }

  /** wiki_teams 为空时，从 usercenter 库 uc_teams / uc_team_members 一次性拷贝（保留 id，幂等） */
  private async copyTeamsFromUsercenter() {
    const local = await this.dataSource.query(
      `SELECT count(*)::int AS n FROM wiki_teams`,
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
        `SELECT to_regclass('public.uc_teams') AS name`,
      );
      if (!exists[0]?.name) {
        return;
      }
      const remote = await src.query(`SELECT count(*)::int AS n FROM uc_teams`);
      if (Number(remote[0]?.n ?? 0) === 0) {
        return;
      }
      const teams = await src.query(`SELECT * FROM uc_teams`);
      for (const row of teams) {
        await this.dataSource.query(
          `INSERT INTO wiki_teams
            (id, app_code, biz_code, code, name, description, status, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (id) DO NOTHING`,
          [
            row.id,
            row.app_code,
            row.biz_code,
            row.code,
            row.name,
            row.description ?? null,
            row.status ?? 1,
            row.created_at,
            row.updated_at,
          ],
        );
      }
      const members = await src.query(`SELECT * FROM uc_team_members`);
      for (const row of members) {
        await this.dataSource.query(
          `INSERT INTO wiki_team_members
            (id, team_id, account_id, role, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (id) DO NOTHING`,
          [
            row.id,
            row.team_id,
            row.account_id,
            row.role,
            row.created_at,
            row.updated_at,
          ],
        );
      }
      this.logger.log(
        `已从 usercenter 迁入团队 ${teams.length}、成员 ${members.length}`,
      );
    } finally {
      await src.destroy();
    }
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
      let copiedCategories = 0;
      let skipped = 0;
      for (const row of cats) {
        const appCode = String(row.app_code ?? '').trim();
        if (!appCode || (row.kind && row.kind !== 'article')) {
          skipped += 1;
          continue;
        }
        await this.dataSource.query(
          `INSERT INTO doc_categories
            (id, app_code, slug, name, hint, color, kind, nav, sort, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT (id) DO NOTHING`,
          [
            row.id,
            appCode,
            row.slug,
            row.name,
            row.hint ?? '',
            row.color,
            'article',
            row.nav === true,
            row.sort ?? 0,
            row.created_at,
            row.updated_at,
          ],
        );
        copiedCategories += 1;
      }
      const docs = await src.query(`SELECT * FROM doc_documents`);
      const copiedDocs = [];
      for (const row of docs) {
        const appCode = String(row.app_code ?? '').trim();
        const kind = row.kind ?? 'article';
        if (!appCode || kind !== 'article') {
          skipped += 1;
          continue;
        }
        copiedDocs.push(row);
        const visibility = row.visibility === 'public' ? 'public' : 'private';
        await this.dataSource.query(
          `INSERT INTO doc_documents
            (id, app_code, slug, title, kind, category, category_id, parent_id, tree_sort,
             summary, cover_url, props, body_format, body, visibility, published_at, author_id,
             created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,NULL,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
           ON CONFLICT (id) DO NOTHING`,
          [
            row.id,
            appCode,
            row.slug,
            row.title,
            'article',
            row.category ?? '',
            row.category_id ?? null,
            row.tree_sort ?? 0,
            row.summary ?? '',
            row.cover_url ?? '',
            row.props ?? {},
            row.body_format ?? 'editorjs',
            row.body ?? { time: Date.now(), version: '2.30.7', blocks: [] },
            visibility,
            row.published_at ?? null,
            row.author_id ?? null,
            row.created_at,
            row.updated_at,
          ],
        );
      }
      const copiedIds = new Set(copiedDocs.map((row) => row.id));
      for (const row of copiedDocs) {
        if (!row.parent_id || !copiedIds.has(row.parent_id)) {
          continue;
        }
        await this.dataSource.query(
          `UPDATE doc_documents SET parent_id = $2 WHERE id = $1`,
          [row.id, row.parent_id],
        );
      }
      this.logger.log(
        `已从共享库迁入分类 ${copiedCategories}、文档 ${copiedDocs.length}，跳过 ${skipped}（缺 app_code 或非 article）`,
      );
    } finally {
      await src.destroy();
    }
  }
}
