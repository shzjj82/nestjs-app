import type { MigrationInterface, QueryRunner } from 'typeorm';

/** 识别任务是通用视觉任务，不按订单 OCR 命名。 */
export class VisionJobs1760000003100 implements MigrationInterface {
  name = 'VisionJobs1760000003100';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        IF to_regclass('public.ag_ocr_jobs') IS NOT NULL
           AND to_regclass('public.ag_vision_jobs') IS NULL THEN
          ALTER TABLE ag_ocr_jobs RENAME TO ag_vision_jobs;
        END IF;
        IF to_regclass('public.ag_ocr_images') IS NOT NULL
           AND to_regclass('public.ag_vision_images') IS NULL THEN
          ALTER TABLE ag_ocr_images RENAME TO ag_vision_images;
        END IF;
      END $$
    `);
    await queryRunner.query(`
      ALTER TABLE ag_vision_jobs ADD COLUMN IF NOT EXISTS prompt text
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'ag_vision_jobs' AND column_name = 'user_id'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'ag_vision_jobs' AND column_name = 'account_id'
        ) THEN
          ALTER TABLE ag_vision_jobs RENAME COLUMN user_id TO account_id;
        END IF;
      END $$
    `);
  }

  async down(): Promise<void> {
    return undefined;
  }
}
