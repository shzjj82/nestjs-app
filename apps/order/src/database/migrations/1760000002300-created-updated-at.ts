import type { MigrationInterface, QueryRunner } from 'typeorm';

/** 订单明细补齐 created_at / updated_at；实体统一用 TypeORM 时间装饰器 */
export class OrderCreatedUpdatedAt1760000002300 implements MigrationInterface {
  name = 'OrderCreatedUpdatedAt1760000002300';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE od_order_items
        ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
        ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE od_order_items
        DROP COLUMN IF EXISTS created_at,
        DROP COLUMN IF EXISTS updated_at
    `);
  }
}
