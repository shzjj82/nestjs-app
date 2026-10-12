import type { MigrationInterface, QueryRunner } from 'typeorm';

/** 门店绑定账号可设别名（展示用，不改账户本身） */
export class StoreStaffAlias1760800000000 implements MigrationInterface {
  name = 'StoreStaffAlias1760800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE recycle_store_staff
        ADD COLUMN IF NOT EXISTS alias varchar(64) NOT NULL DEFAULT ''
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE recycle_store_staff DROP COLUMN IF EXISTS alias
    `);
  }
}
