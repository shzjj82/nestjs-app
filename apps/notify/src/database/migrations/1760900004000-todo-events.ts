import type { MigrationInterface, QueryRunner } from 'typeorm';

export class TodoEvents1760900004000 implements MigrationInterface {
  name = 'TodoEvents1760900004000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS nt_todo_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        biz_code varchar(64) NOT NULL,
        todo_id uuid NOT NULL,
        action varchar(64) NOT NULL,
        from_status varchar(16),
        to_status varchar(16),
        actor_id varchar(64),
        title varchar(200),
        outcome varchar(16) NOT NULL DEFAULT 'success',
        payload jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_nt_todo_events_todo_created
      ON nt_todo_events (todo_id, created_at DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_nt_todo_events_biz_created
      ON nt_todo_events (biz_code, created_at DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_nt_todo_events_actor
      ON nt_todo_events (actor_id, created_at DESC)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS ix_nt_todo_events_actor`);
    await queryRunner.query(`DROP INDEX IF EXISTS ix_nt_todo_events_biz_created`);
    await queryRunner.query(`DROP INDEX IF EXISTS ix_nt_todo_events_todo_created`);
    await queryRunner.query(`DROP TABLE IF EXISTS nt_todo_events`);
  }
}
