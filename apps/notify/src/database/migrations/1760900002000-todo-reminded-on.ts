import type { MigrationInterface, QueryRunner } from 'typeorm';

export class TodoRemindedOn1760900002000 implements MigrationInterface {
  name = 'TodoRemindedOn1760900002000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE nt_todos
      ADD COLUMN IF NOT EXISTS reminded_on date
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_nt_todos_due_open
      ON nt_todos (due_at)
      WHERE status = 'open' AND due_at IS NOT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS ix_nt_todos_due_open');
    await queryRunner.query('ALTER TABLE nt_todos DROP COLUMN IF EXISTS reminded_on');
  }
}
