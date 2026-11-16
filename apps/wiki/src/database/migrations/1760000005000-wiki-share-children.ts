import { MigrationInterface, QueryRunner } from 'typeorm';

export class WikiShareChildren1760000005000 implements MigrationInterface {
  name = 'WikiShareChildren1760000005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE wiki_shares
      ADD COLUMN IF NOT EXISTS children jsonb NOT NULL DEFAULT '[]'::jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE wiki_shares DROP COLUMN IF EXISTS children`);
  }
}
