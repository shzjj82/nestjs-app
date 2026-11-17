import type { MigrationInterface, QueryRunner } from 'typeorm';

export class WikiOpEvents1760000007000 implements MigrationInterface {
  name = 'WikiOpEvents1760000007000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS wiki_op_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        biz_code varchar(64) NOT NULL,
        action varchar(64) NOT NULL,
        resource_type varchar(32) NOT NULL,
        resource_id varchar(64) NOT NULL,
        actor_id varchar(64),
        actor_user_id varchar(64),
        title varchar(200),
        outcome varchar(16) NOT NULL DEFAULT 'success',
        payload jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_wiki_op_events_biz_created
      ON wiki_op_events (biz_code, created_at DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_wiki_op_events_resource
      ON wiki_op_events (resource_type, resource_id, created_at DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_wiki_op_events_actor
      ON wiki_op_events (actor_id, created_at DESC)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS ix_wiki_op_events_actor`);
    await queryRunner.query(`DROP INDEX IF EXISTS ix_wiki_op_events_resource`);
    await queryRunner.query(`DROP INDEX IF EXISTS ix_wiki_op_events_biz_created`);
    await queryRunner.query(`DROP TABLE IF EXISTS wiki_op_events`);
  }
}
