import type { MigrationInterface, QueryRunner } from 'typeorm';

export class WikiTeamsSchema1760000002000 implements MigrationInterface {
  name = 'WikiTeamsSchema1760000002000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS wiki_teams (
        id uuid PRIMARY KEY,
        app_code varchar(64) NOT NULL,
        biz_code varchar(64) NOT NULL,
        code varchar(16) NOT NULL,
        name varchar(64) NOT NULL,
        description varchar(255),
        status smallint NOT NULL DEFAULT 1,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_wiki_teams_app_biz
      ON wiki_teams (app_code, biz_code)
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_wiki_teams_app_biz_code
      ON wiki_teams (app_code, biz_code, code)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS wiki_team_members (
        id uuid PRIMARY KEY,
        team_id uuid NOT NULL,
        account_id uuid NOT NULL,
        role varchar(16) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_wiki_team_members_team
          FOREIGN KEY (team_id) REFERENCES wiki_teams(id) ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_wiki_team_members_team_account
      ON wiki_team_members (team_id, account_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_wiki_team_members_account
      ON wiki_team_members (account_id)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS wiki_team_members`);
    await queryRunner.query(`DROP TABLE IF EXISTS wiki_teams`);
  }
}
