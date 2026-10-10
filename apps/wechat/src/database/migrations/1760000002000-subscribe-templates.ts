import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 小程序订阅消息模板配置。
 *
 * 模板 ID 属于「小程序 × 场景」维度，跟着小程序走，不进业务服务 ——
 * 业务服务只说「发什么场景」，由 wechat 服务查表换成模板 ID 再发。
 */
export class SubscribeTemplates1760000002000 implements MigrationInterface {
  name = 'SubscribeTemplates1760000002000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE wx_miniprograms
        ADD COLUMN IF NOT EXISTS subscribe_templates jsonb NOT NULL DEFAULT '{}'::jsonb;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE wx_miniprograms DROP COLUMN IF EXISTS subscribe_templates;
    `);
  }
}
