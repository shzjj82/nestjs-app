import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InitDocsSchema1760000000000 implements MigrationInterface {
  name = 'InitDocsSchema1760000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS doc_categories (
        id uuid PRIMARY KEY,
        app_code varchar(64) NOT NULL,
        slug varchar(64) NOT NULL,
        name varchar(32) NOT NULL,
        hint varchar(128) NOT NULL DEFAULT '',
        color varchar(32) NOT NULL,
        kind varchar(32) NOT NULL DEFAULT 'article',
        nav boolean NOT NULL DEFAULT false,
        sort int NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS doc_documents (
        id uuid PRIMARY KEY,
        app_code varchar(64) NOT NULL,
        slug varchar(80) NOT NULL,
        title varchar(200) NOT NULL,
        kind varchar(32) NOT NULL DEFAULT 'article',
        category varchar(64) NOT NULL DEFAULT '',
        category_id uuid,
        parent_id uuid,
        tree_sort int NOT NULL DEFAULT 0,
        summary text NOT NULL DEFAULT '',
        cover_url varchar(500) NOT NULL DEFAULT '',
        props jsonb NOT NULL DEFAULT '{}'::jsonb,
        body_format varchar(32) NOT NULL DEFAULT 'editorjs',
        body jsonb NOT NULL,
        visibility varchar(16) NOT NULL DEFAULT 'private',
        published_at timestamptz,
        author_id uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_doc_categories_app_slug
      ON doc_categories (app_code, slug)
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_doc_documents_app_slug
      ON doc_documents (app_code, slug)
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_doc_categories_app_code ON doc_categories (app_code)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_doc_documents_app_code ON doc_documents (app_code)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_doc_documents_kind ON doc_documents (kind)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_doc_documents_category ON doc_documents (category)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_doc_documents_parent_id ON doc_documents (parent_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_doc_documents_visibility ON doc_documents (visibility)`,
    );
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE doc_documents
          ADD CONSTRAINT fk_doc_documents_category
          FOREIGN KEY (category_id) REFERENCES doc_categories(id) ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE doc_documents
          ADD CONSTRAINT fk_doc_documents_parent
          FOREIGN KEY (parent_id) REFERENCES doc_documents(id) ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS doc_documents`);
    await queryRunner.query(`DROP TABLE IF EXISTS doc_categories`);
  }
}
