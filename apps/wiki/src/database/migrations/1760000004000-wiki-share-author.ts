import { MigrationInterface, QueryRunner } from 'typeorm';

export class WikiShareAuthor1760000004000 implements MigrationInterface {
  name = 'WikiShareAuthor1760000004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE wiki_shares
      ADD COLUMN IF NOT EXISTS shared_by varchar(80)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE wiki_shares DROP COLUMN IF EXISTS shared_by`);
  }
}
