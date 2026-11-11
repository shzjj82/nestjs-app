import type { MigrationInterface, QueryRunner } from 'typeorm';

export class TodoFourStates1760900003000 implements MigrationInterface {
  name = 'TodoFourStates1760900003000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE nt_todos
        ADD COLUMN IF NOT EXISTS starts_at date,
        ADD COLUMN IF NOT EXISTS started_at timestamptz,
        ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
        ADD COLUMN IF NOT EXISTS started_notice_at timestamptz,
        ADD COLUMN IF NOT EXISTS last_progress_notice_on date,
        ADD COLUMN IF NOT EXISTS last_overdue_notice_on date
    `);
    await queryRunner.query(`
      UPDATE nt_todos
      SET status = 'pending'
      WHERE status = 'open'
    `);
    await queryRunner.query(`
      ALTER TABLE nt_todos
        ALTER COLUMN status SET DEFAULT 'pending'
    `);
    await queryRunner.query(`
      UPDATE nt_todos
      SET starts_at = NULLIF(TRIM(data->>'start'), '')::date
      WHERE starts_at IS NULL
        AND data ? 'start'
        AND COALESCE(TRIM(data->>'start'), '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS ix_nt_todos_open`);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_nt_todos_active
      ON nt_todos (biz_code, user_id)
      WHERE status IN ('pending', 'in_progress', 'open')
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS ix_nt_todos_active`);
    await queryRunner.query(`
      UPDATE nt_todos
      SET status = 'open'
      WHERE status IN ('pending', 'in_progress')
    `);
    await queryRunner.query(`
      ALTER TABLE nt_todos
        ALTER COLUMN status SET DEFAULT 'open'
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_nt_todos_open
      ON nt_todos (biz_code, user_id)
      WHERE status = 'open'
    `);
    await queryRunner.query(`
      ALTER TABLE nt_todos
        DROP COLUMN IF EXISTS starts_at,
        DROP COLUMN IF EXISTS started_at,
        DROP COLUMN IF EXISTS cancelled_at,
        DROP COLUMN IF EXISTS started_notice_at,
        DROP COLUMN IF EXISTS last_progress_notice_on,
        DROP COLUMN IF EXISTS last_overdue_notice_on
    `);
  }
}
