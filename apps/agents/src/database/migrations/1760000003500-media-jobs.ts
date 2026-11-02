import type { MigrationInterface, QueryRunner } from 'typeorm';

export class MediaJobs1760000003500 implements MigrationInterface {
  name = 'MediaJobs1760000003500';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ag_media_jobs (
        id varchar(64) PRIMARY KEY,
        biz_code varchar(64) NOT NULL,
        account_id varchar(64),
        kind varchar(16) NOT NULL,
        provider varchar(16) NOT NULL,
        status varchar(32) NOT NULL DEFAULT 'queued',
        source_url text,
        source_mime varchar(128),
        upstream_task_id varchar(128),
        next_poll_at timestamptz,
        poll_count int NOT NULL DEFAULT 0,
        result jsonb,
        error_message text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        finished_at timestamptz
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ag_media_jobs_biz_created_idx
      ON ag_media_jobs (biz_code, created_at DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ag_media_jobs_poll_idx
      ON ag_media_jobs (status, next_poll_at)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS ag_media_jobs`);
  }
}
