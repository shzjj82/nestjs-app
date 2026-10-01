import type { MigrationInterface, QueryRunner } from 'typeorm';

export class OrderAccountId1760000002200 implements MigrationInterface {
  name = 'OrderAccountId1760000002200';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'od_orders' AND column_name = 'user_id'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'od_orders' AND column_name = 'account_id'
        ) THEN
          ALTER TABLE od_orders RENAME COLUMN user_id TO account_id;
        END IF;
      END $$
    `);
  }

  async down(): Promise<void> {
    return undefined;
  }
}
