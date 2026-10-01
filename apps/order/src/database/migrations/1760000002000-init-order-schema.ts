import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InitOrderSchema1760000002000 implements MigrationInterface {
  name = 'InitOrderSchema1760000002000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS od_orders (
        id varchar(64) PRIMARY KEY,
        biz_code varchar(64) NOT NULL,
        account_id uuid,
        status varchar(32) NOT NULL DEFAULT 'pending',
        title varchar(80),
        amount int NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS od_orders_biz_created_idx
      ON od_orders (biz_code, created_at DESC)
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS od_order_items (
        id bigserial PRIMARY KEY,
        order_id varchar(64) NOT NULL REFERENCES od_orders(id) ON DELETE CASCADE,
        name varchar(200) NOT NULL,
        quantity int NOT NULL DEFAULT 1,
        price int NOT NULL DEFAULT 0,
        amount int NOT NULL DEFAULT 0,
        sort_order int NOT NULL DEFAULT 0
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS od_order_items_order_id_idx ON od_order_items (order_id)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS od_order_items`);
    await queryRunner.query(`DROP TABLE IF EXISTS od_orders`);
  }
}
