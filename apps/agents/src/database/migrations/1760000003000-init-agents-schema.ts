import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InitAgentsSchema1760000003000 implements MigrationInterface {
  name = 'InitAgentsSchema1760000003000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ag_vision_jobs (
        id varchar(64) PRIMARY KEY,
        biz_code varchar(64) NOT NULL,
        account_id uuid,
        status varchar(32) NOT NULL DEFAULT 'pending',
        model varchar(64),
        prompt text,
        result jsonb,
        error_message text,
        created_at timestamptz NOT NULL DEFAULT now(),
        finished_at timestamptz
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ag_vision_jobs_biz_created_idx
      ON ag_vision_jobs (biz_code, created_at DESC)
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ag_vision_images (
        id bigserial PRIMARY KEY,
        job_id varchar(64) NOT NULL REFERENCES ag_vision_jobs(id) ON DELETE CASCADE,
        url text NOT NULL,
        key text NOT NULL,
        sort_order int NOT NULL DEFAULT 0
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ag_vision_images_job_id_idx ON ag_vision_images (job_id)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS ag_vision_images`);
    await queryRunner.query(`DROP TABLE IF EXISTS ag_vision_jobs`);
  }
}
