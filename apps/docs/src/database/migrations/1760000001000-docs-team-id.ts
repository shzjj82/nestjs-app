import type { MigrationInterface, QueryRunner } from 'typeorm';

export class DocsTeamId1760000001000 implements MigrationInterface {
  name = 'DocsTeamId1760000001000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE doc_documents
      ADD COLUMN IF NOT EXISTS team_id uuid
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_doc_documents_team_id
      ON doc_documents (team_id)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_doc_documents_team_id`);
    await queryRunner.query(`ALTER TABLE doc_documents DROP COLUMN IF EXISTS team_id`);
  }
}
