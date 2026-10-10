import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 订单记住下单小程序的 appId。
 *
 * 背景：订阅消息要用「该小程序登记的模板 ID」才能发，
 * 而模板是按小程序维度配的。订单上不记 appId，事后通知时无从定位。
 */
export class OrderWechatAppId1760400000000 implements MigrationInterface {
  name = 'OrderWechatAppId1760400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE recycle_orders
        ADD COLUMN IF NOT EXISTS wechat_app_id varchar(64);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE recycle_orders DROP COLUMN IF EXISTS wechat_app_id;
    `);
  }
}
