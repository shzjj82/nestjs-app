import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Ocr1760000003600 implements MigrationInterface {
  name = 'Ocr1760000003600';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ag_ocr_cache (
        url_hash varchar(64) PRIMARY KEY,
        url text NOT NULL,
        text text NOT NULL,
        model varchar(64) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ag_ocr_jobs (
        id varchar(64) PRIMARY KEY,
        biz_code varchar(64) NOT NULL,
        account_id uuid NOT NULL,
        status varchar(16) NOT NULL DEFAULT 'pending',
        image_urls jsonb NOT NULL,
        result jsonb,
        error_message text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        finished_at timestamptz
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS ag_ocr_jobs`);
    await queryRunner.query(`DROP TABLE IF EXISTS ag_ocr_cache`);
  }
}
