import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 回收目录 schema：类型 / 品牌 / 型号（含回收指导价）。
 *
 * 目录是「参考数据」（reference data），不是枚举：
 * 型号与价格会随市场行情频繁变动，交给字典表 + 后台维护，
 * 而不是写进 PG 枚举（改枚举要迁移，太重）。
 *
 * 字典表只建结构，初始数据由 CatalogModule 启动时的 upsert 灌入，
 * 保证「改价 / 加型号」只需改种子数据，不需要再写迁移。
 */
export class CatalogSchema1760300000000 implements MigrationInterface {
  name = 'CatalogSchema1760300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS recycle_cartridge_types (
        key varchar(16) PRIMARY KEY,
        label varchar(32) NOT NULL,
        description varchar(128) NOT NULL DEFAULT '',
        color varchar(16) NOT NULL DEFAULT '#3b82f6',
        sort int NOT NULL DEFAULT 0,
        enabled boolean NOT NULL DEFAULT true
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS recycle_brands (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        brand varchar(64) NOT NULL,
        type varchar(16) NOT NULL,
        logo varchar(512) NOT NULL DEFAULT '',
        sort int NOT NULL DEFAULT 0,
        enabled boolean NOT NULL DEFAULT true
      );
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_recycle_brands_brand_type
        ON recycle_brands (brand, type);
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS recycle_models (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        type varchar(16) NOT NULL,
        brand varchar(64) NOT NULL,
        name varchar(64) NOT NULL,
        spec varchar(64) NOT NULL DEFAULT '',
        fits varchar(255) NOT NULL DEFAULT '',
        chip boolean NOT NULL DEFAULT false,
        price int NOT NULL DEFAULT 0,
        sort int NOT NULL DEFAULT 0,
        enabled boolean NOT NULL DEFAULT true
      );
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_recycle_models_key
        ON recycle_models (type, brand, name);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_recycle_models_scope
        ON recycle_models (type, brand);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS recycle_models;`);
    await queryRunner.query(`DROP TABLE IF EXISTS recycle_brands;`);
    await queryRunner.query(`DROP TABLE IF EXISTS recycle_cartridge_types;`);
  }
}
