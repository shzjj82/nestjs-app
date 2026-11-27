import type { MigrationInterface, QueryRunner } from 'typeorm';
import { linkifyBareCitations } from '@app/common';

/** 只跑一次：把已经入库的《标题》裸网址收成 Markdown 链接。 */
export class LinkifyBareCitations1760000003700 implements MigrationInterface {
  name = 'LinkifyBareCitations1760000003700';

  async up(queryRunner: QueryRunner): Promise<void> {
    const rows = (await queryRunner.query(
      `
      SELECT id, content
      FROM ag_messages
      WHERE role = 'assistant'
        AND content LIKE '%《%'
        AND content ~ 'https?://'
      `,
    )) as Array<{ id: string; content: string }>;
    for (const row of rows) {
      const next = linkifyBareCitations(row.content);
      if (next === row.content) {
        continue;
      }
      await queryRunner.query(`UPDATE ag_messages SET content = $1 WHERE id = $2`, [next, row.id]);
    }
  }

  async down(): Promise<void> {
    // 正文改写无法还原成原来的裸网址。
  }
}
