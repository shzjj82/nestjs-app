import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InitNotifySchema1760900000000 implements MigrationInterface {
  name = 'InitNotifySchema1760900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS nt_messages (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        biz_code varchar(64) NOT NULL,
        user_id varchar(64) NOT NULL,
        title varchar(120) NOT NULL,
        content text NOT NULL,
        category varchar(64) NOT NULL DEFAULT 'system',
        source varchar(64) NOT NULL DEFAULT 'system',
        data jsonb,
        read_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_nt_messages_inbox
      ON nt_messages (biz_code, user_id, created_at DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_nt_messages_unread
      ON nt_messages (biz_code, user_id)
      WHERE read_at IS NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS nt_messages');
  }
}
