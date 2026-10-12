import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 回收业务表补齐 created_at / updated_at（timestamptz）。
 * 实体侧统一用 @CreateDateColumn / @UpdateDateColumn。
 */
export class CreatedUpdatedAt1760700000000 implements MigrationInterface {
  name = 'CreatedUpdatedAt1760700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of [
      'recycle_cartridge_types',
      'recycle_brands',
      'recycle_models',
      'recycle_order_items',
    ]) {
      await queryRunner.query(`
        ALTER TABLE ${table}
          ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
          ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()
      `);
    }
    await queryRunner.query(`
      ALTER TABLE recycle_stores
        ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()
    `);
    await queryRunner.query(`
      ALTER TABLE recycle_store_staff
        ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE recycle_store_staff DROP COLUMN IF EXISTS updated_at
    `);
    await queryRunner.query(`
      ALTER TABLE recycle_stores DROP COLUMN IF EXISTS updated_at
    `);
    for (const table of [
      'recycle_order_items',
      'recycle_models',
      'recycle_brands',
      'recycle_cartridge_types',
    ]) {
      await queryRunner.query(`
        ALTER TABLE ${table}
          DROP COLUMN IF EXISTS created_at,
          DROP COLUMN IF EXISTS updated_at
      `);
    }
  }
}
