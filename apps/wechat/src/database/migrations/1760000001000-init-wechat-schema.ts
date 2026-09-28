import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InitWechatSchema1760000001000 implements MigrationInterface {
  name = 'InitWechatSchema1760000001000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS wx_miniprograms (
        id uuid PRIMARY KEY,
        code varchar(64) NOT NULL,
        name varchar(64) NOT NULL,
        app_id varchar(64) NOT NULL,
        secret varchar(128) NOT NULL,
        status smallint NOT NULL DEFAULT 1,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_wx_miniprograms_code
      ON wx_miniprograms (code)
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_wx_miniprograms_app_id
      ON wx_miniprograms (app_id)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS wx_miniprograms');
  }
}
