import type { MigrationInterface, QueryRunner } from 'typeorm';

/** 目录与订单明细改为用 typeId / brandId / modelId 关联 */
export class CatalogIds1760500000000 implements MigrationInterface {
  name = 'CatalogIds1760500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE recycle_cartridge_types
        ADD COLUMN IF NOT EXISTS id uuid
    `);
    await queryRunner.query(`
      UPDATE recycle_cartridge_types SET id = gen_random_uuid() WHERE id IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE recycle_cartridge_types ALTER COLUMN id SET DEFAULT gen_random_uuid()
    `);
    await queryRunner.query(`
      ALTER TABLE recycle_cartridge_types ALTER COLUMN id SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE recycle_cartridge_types DROP CONSTRAINT IF EXISTS recycle_cartridge_types_pkey
    `);
    await queryRunner.query(`
      ALTER TABLE recycle_cartridge_types ADD PRIMARY KEY (id)
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_recycle_cartridge_types_key
        ON recycle_cartridge_types (key)
    `);

    await queryRunner.query(`
      ALTER TABLE recycle_brands ADD COLUMN IF NOT EXISTS type_id uuid
    `);
    await queryRunner.query(`
      UPDATE recycle_brands b
         SET type_id = t.id
        FROM recycle_cartridge_types t
       WHERE b.type_id IS NULL AND t.key = b.type
    `);
    await queryRunner.query(`
      DELETE FROM recycle_brands WHERE type_id IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE recycle_brands ALTER COLUMN type_id SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE recycle_brands
        DROP CONSTRAINT IF EXISTS recycle_brands_type_id_fkey
    `);
    await queryRunner.query(`
      ALTER TABLE recycle_brands
        ADD CONSTRAINT recycle_brands_type_id_fkey
        FOREIGN KEY (type_id) REFERENCES recycle_cartridge_types(id) ON DELETE RESTRICT
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS ux_recycle_brands_brand_type`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_recycle_brands_type_brand
        ON recycle_brands (type_id, brand)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_recycle_brands_type_id ON recycle_brands (type_id)
    `);
    await queryRunner.query(`ALTER TABLE recycle_brands DROP COLUMN IF EXISTS type`);

    await queryRunner.query(`
      ALTER TABLE recycle_models
        ADD COLUMN IF NOT EXISTS type_id uuid,
        ADD COLUMN IF NOT EXISTS brand_id uuid
    `);
    await queryRunner.query(`
      UPDATE recycle_models m
         SET type_id = t.id
        FROM recycle_cartridge_types t
       WHERE m.type_id IS NULL AND t.key = m.type
    `);
    await queryRunner.query(`
      UPDATE recycle_models m
         SET brand_id = b.id
        FROM recycle_brands b
       WHERE m.brand_id IS NULL
         AND b.type_id = m.type_id
         AND b.brand = m.brand
    `);
    await queryRunner.query(`
      DELETE FROM recycle_models WHERE type_id IS NULL OR brand_id IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE recycle_models
        ALTER COLUMN type_id SET NOT NULL,
        ALTER COLUMN brand_id SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE recycle_models
        ADD CONSTRAINT recycle_models_type_id_fkey
        FOREIGN KEY (type_id) REFERENCES recycle_cartridge_types(id) ON DELETE RESTRICT
    `);
    await queryRunner.query(`
      ALTER TABLE recycle_models
        ADD CONSTRAINT recycle_models_brand_id_fkey
        FOREIGN KEY (brand_id) REFERENCES recycle_brands(id) ON DELETE RESTRICT
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS ux_recycle_models_key`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_recycle_models_scope`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_recycle_models_brand_name
        ON recycle_models (brand_id, name)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_recycle_models_scope
        ON recycle_models (type_id, brand_id)
    `);
    await queryRunner.query(`
      ALTER TABLE recycle_models
        DROP COLUMN IF EXISTS type,
        DROP COLUMN IF EXISTS brand
    `);

    await queryRunner.query(`
      ALTER TABLE recycle_order_items
        ADD COLUMN IF NOT EXISTS type_id uuid,
        ADD COLUMN IF NOT EXISTS brand_id uuid,
        ADD COLUMN IF NOT EXISTS model_id uuid
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE recycle_order_items
        DROP COLUMN IF EXISTS type_id,
        DROP COLUMN IF EXISTS brand_id,
        DROP COLUMN IF EXISTS model_id
    `);

    await queryRunner.query(`
      ALTER TABLE recycle_models
        ADD COLUMN IF NOT EXISTS type varchar(16),
        ADD COLUMN IF NOT EXISTS brand varchar(64)
    `);
    await queryRunner.query(`
      UPDATE recycle_models m
         SET type = t.key, brand = b.brand
        FROM recycle_cartridge_types t, recycle_brands b
       WHERE t.id = m.type_id AND b.id = m.brand_id
    `);
    await queryRunner.query(`
      ALTER TABLE recycle_models
        DROP CONSTRAINT IF EXISTS recycle_models_type_id_fkey,
        DROP CONSTRAINT IF EXISTS recycle_models_brand_id_fkey
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS ux_recycle_models_brand_name`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_recycle_models_scope`);
    await queryRunner.query(`
      ALTER TABLE recycle_models
        DROP COLUMN IF EXISTS type_id,
        DROP COLUMN IF EXISTS brand_id
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_recycle_models_key
        ON recycle_models (type, brand, name)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_recycle_models_scope
        ON recycle_models (type, brand)
    `);

    await queryRunner.query(`
      ALTER TABLE recycle_brands ADD COLUMN IF NOT EXISTS type varchar(16)
    `);
    await queryRunner.query(`
      UPDATE recycle_brands b
         SET type = t.key
        FROM recycle_cartridge_types t
       WHERE t.id = b.type_id
    `);
    await queryRunner.query(`
      ALTER TABLE recycle_brands DROP CONSTRAINT IF EXISTS recycle_brands_type_id_fkey
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS ux_recycle_brands_type_brand`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_recycle_brands_type_id`);
    await queryRunner.query(`ALTER TABLE recycle_brands DROP COLUMN IF EXISTS type_id`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_recycle_brands_brand_type
        ON recycle_brands (brand, type)
    `);

    await queryRunner.query(`
      ALTER TABLE recycle_cartridge_types DROP CONSTRAINT IF EXISTS recycle_cartridge_types_pkey
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS ux_recycle_cartridge_types_key`);
    await queryRunner.query(`
      ALTER TABLE recycle_cartridge_types ADD PRIMARY KEY (key)
    `);
    await queryRunner.query(`ALTER TABLE recycle_cartridge_types DROP COLUMN IF EXISTS id`);
  }
}
