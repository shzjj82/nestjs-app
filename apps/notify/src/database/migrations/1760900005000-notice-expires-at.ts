import type { MigrationInterface, QueryRunner } from 'typeorm';

export class NoticeExpiresAt1760900005000 implements MigrationInterface {
  name = 'NoticeExpiresAt1760900005000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE nt_notices
      ADD COLUMN IF NOT EXISTS expires_at timestamptz
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE nt_notices DROP COLUMN IF EXISTS expires_at`);
  }
}
