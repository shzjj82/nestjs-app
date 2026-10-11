import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Stores1760600000000 implements MigrationInterface {
  name = 'Stores1760600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS recycle_stores (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        biz_code varchar(64) NOT NULL,
        name varchar(64) NOT NULL,
        contact varchar(32) NOT NULL DEFAULT '',
        phone varchar(32) NOT NULL DEFAULT '',
        province varchar(32) NOT NULL DEFAULT '',
        city varchar(32) NOT NULL DEFAULT '',
        district varchar(32) NOT NULL DEFAULT '',
        address varchar(255) NOT NULL DEFAULT '',
        postal varchar(16) NOT NULL DEFAULT '',
        longitude double precision,
        latitude double precision,
        bind_scene varchar(32) NOT NULL,
        enabled boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_recycle_stores_bind_scene
        ON recycle_stores (bind_scene)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_recycle_stores_biz_enabled
        ON recycle_stores (biz_code, enabled)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS recycle_store_staff (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        biz_code varchar(64) NOT NULL,
        store_id uuid NOT NULL REFERENCES recycle_stores(id) ON DELETE CASCADE,
        account_id varchar(64) NOT NULL,
        user_id varchar(64) NOT NULL,
        bound_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_recycle_store_staff_store_account
        ON recycle_store_staff (store_id, account_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_recycle_store_staff_biz_account
        ON recycle_store_staff (biz_code, account_id)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS recycle_store_staff`);
    await queryRunner.query(`DROP TABLE IF EXISTS recycle_stores`);
  }
}
