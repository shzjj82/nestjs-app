import type { MigrationInterface, QueryRunner } from 'typeorm';

export class WikiShares1760000003000 implements MigrationInterface {
  name = 'WikiShares1760000003000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS wiki_shares (
        token varchar(64) PRIMARY KEY,
        app_code varchar(64) NOT NULL,
        page_id uuid NOT NULL,
        title varchar(200) NOT NULL,
        body jsonb NOT NULL,
        owner_account_id uuid NOT NULL,
        page_owner_account_id uuid,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz,
        allow_reshare boolean NOT NULL DEFAULT false,
        parent_token varchar(64),
        revoked_at timestamptz
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_wiki_shares_app_page
      ON wiki_shares (app_code, page_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_wiki_shares_parent
      ON wiki_shares (parent_token)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_wiki_shares_owner
      ON wiki_shares (owner_account_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_wiki_shares_page_owner
      ON wiki_shares (page_owner_account_id)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS wiki_shares`);
  }
}
