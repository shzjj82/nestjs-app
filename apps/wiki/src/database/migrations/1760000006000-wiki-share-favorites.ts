import { MigrationInterface, QueryRunner } from 'typeorm';

export class WikiShareFavorites1760000006000 implements MigrationInterface {
  name = 'WikiShareFavorites1760000006000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS wiki_share_favorites (
        account_id uuid NOT NULL,
        token varchar(64) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (account_id, token)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_wiki_share_favorites_account
      ON wiki_share_favorites (account_id, created_at)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS wiki_share_favorites`,
    );
  }
}
