import type { MigrationInterface, QueryRunner } from 'typeorm';

/** vision 任务 / 图片补齐时间字段；实体用 @CreateDateColumn / @UpdateDateColumn */
export class AgentsCreatedUpdatedAt1760000003300 implements MigrationInterface {
  name = 'AgentsCreatedUpdatedAt1760000003300';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE ag_vision_jobs
        ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()
    `);
    await queryRunner.query(`
      ALTER TABLE ag_vision_images
        ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now()
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE ag_vision_images DROP COLUMN IF EXISTS created_at
    `);
    await queryRunner.query(`
      ALTER TABLE ag_vision_jobs DROP COLUMN IF EXISTS updated_at
    `);
  }
}
