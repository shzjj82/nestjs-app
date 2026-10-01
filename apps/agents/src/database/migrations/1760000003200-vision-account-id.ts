import type { MigrationInterface, QueryRunner } from 'typeorm';

export class VisionAccountId1760000003200 implements MigrationInterface {
  name = 'VisionAccountId1760000003200';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        IF to_regclass('public.ag_vision_jobs') IS NOT NULL
           AND EXISTS (
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
