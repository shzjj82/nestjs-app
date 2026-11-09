import type { MigrationInterface, QueryRunner } from 'typeorm';

export class SplitNoticeAndTodo1760900001000 implements MigrationInterface {
  name = 'SplitNoticeAndTodo1760900001000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.nt_messages') IS NOT NULL
           AND to_regclass('public.nt_notices') IS NULL THEN
          ALTER TABLE nt_messages RENAME TO nt_notices;
        END IF;
      END $$
    `);
    await queryRunner.query(`
      ALTER INDEX IF EXISTS ix_nt_messages_inbox RENAME TO ix_nt_notices_inbox
    `);
    await queryRunner.query(`
      ALTER INDEX IF EXISTS ix_nt_messages_unread RENAME TO ix_nt_notices_unread
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS nt_notices (
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
      CREATE INDEX IF NOT EXISTS ix_nt_notices_inbox
      ON nt_notices (biz_code, user_id, created_at DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_nt_notices_unread
      ON nt_notices (biz_code, user_id)
      WHERE read_at IS NULL
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS nt_todos (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        biz_code varchar(64) NOT NULL,
        user_id varchar(64) NOT NULL,
        title varchar(120) NOT NULL,
        content text NOT NULL,
        category varchar(64) NOT NULL DEFAULT 'system',
        source varchar(64) NOT NULL DEFAULT 'system',
        status varchar(16) NOT NULL DEFAULT 'open',
        data jsonb,
        due_at timestamptz,
        finished_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_nt_todos_inbox
      ON nt_todos (biz_code, user_id, created_at DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_nt_todos_open
      ON nt_todos (biz_code, user_id)
      WHERE status = 'open'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS nt_todos');
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.nt_notices') IS NOT NULL
           AND to_regclass('public.nt_messages') IS NULL THEN
          ALTER TABLE nt_notices RENAME TO nt_messages;
        END IF;
      END $$
    `);
  }
}
