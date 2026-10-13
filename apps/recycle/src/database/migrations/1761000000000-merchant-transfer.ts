import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 商家转账（用户确认收款）：
 * - 订单状态新增 paying（已发起转账，待用户确认）
 * - 落库 package_info / 微信单号 / 转账状态
 *
 * ALTER TYPE ... ADD VALUE 不能与使用该枚举的语句同事务，故关闭事务。
 */
export class MerchantTransfer1761000000000 implements MigrationInterface {
  name = 'MerchantTransfer1761000000000';
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE recycle_order_status ADD VALUE IF NOT EXISTS 'paying' AFTER 'accepted';
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE recycle_orders
        ADD COLUMN IF NOT EXISTS transfer_package_info text,
        ADD COLUMN IF NOT EXISTS transfer_wx_bill_no varchar(64),
        ADD COLUMN IF NOT EXISTS transfer_state varchar(32)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE recycle_orders
        DROP COLUMN IF EXISTS transfer_package_info,
        DROP COLUMN IF EXISTS transfer_wx_bill_no,
        DROP COLUMN IF EXISTS transfer_state
    `);
    // PG 无法安全删除 enum 值，down 不回滚 paying
  }
}
