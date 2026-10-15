import type { MigrationInterface, QueryRunner } from 'typeorm';

/** RAG 文档分块向量表；维度默认 1536，与 AI_EMBEDDING_DIM / text-embedding-3-small 对齐 */
export class RagChunks1760000003400 implements MigrationInterface {
  name = 'RagChunks1760000003400';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ag_rag_chunks (
        id uuid PRIMARY KEY,
        app_code varchar(64) NOT NULL,
        author_id uuid,
        team_id uuid,
        visibility varchar(16) NOT NULL DEFAULT 'private',
        doc_id uuid NOT NULL,
        slug varchar(80) NOT NULL DEFAULT '',
        title varchar(200) NOT NULL DEFAULT '',
        source_type varchar(32) NOT NULL DEFAULT 'editorjs',
        source_key text,
        chunk_index int NOT NULL DEFAULT 0,
        content text NOT NULL,
        embedding vector(1536) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ag_rag_chunks_app_author_idx
      ON ag_rag_chunks (app_code, author_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ag_rag_chunks_doc_id_idx
      ON ag_rag_chunks (doc_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ag_rag_chunks_app_team_idx
      ON ag_rag_chunks (app_code, team_id)
      WHERE team_id IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ag_rag_chunks_embedding_hnsw_idx
      ON ag_rag_chunks
      USING hnsw (embedding vector_cosine_ops)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS ag_rag_chunks`);
  }
}
