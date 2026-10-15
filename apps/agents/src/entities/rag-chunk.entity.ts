import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * RAG 分块元数据。embedding 走原生 vector 列，读写用 QueryRunner / 参数化 SQL，
 * 不在此实体映射，避免 TypeORM 不识 pgvector。
 */
@Entity('ag_rag_chunks')
@Index('ag_rag_chunks_app_author_idx', ['appCode', 'authorId'])
@Index('ag_rag_chunks_doc_id_idx', ['docId'])
export class RagChunkEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ name: 'app_code', type: 'varchar', length: 64 })
  appCode!: string;

  @Column({ name: 'author_id', type: 'uuid', nullable: true })
  authorId!: string | null;

  @Column({ name: 'team_id', type: 'uuid', nullable: true })
  teamId!: string | null;

  @Column({ type: 'varchar', length: 16, default: 'private' })
  visibility!: string;

  @Column({ name: 'doc_id', type: 'uuid' })
  docId!: string;

  @Column({ type: 'varchar', length: 80, default: '' })
  slug!: string;

  @Column({ type: 'varchar', length: 200, default: '' })
  title!: string;

  @Column({ name: 'source_type', type: 'varchar', length: 32, default: 'editorjs' })
  sourceType!: string;

  @Column({ name: 'source_key', type: 'text', nullable: true })
  sourceKey!: string | null;

  @Column({ name: 'chunk_index', type: 'int', default: 0 })
  chunkIndex!: number;

  @Column({ type: 'text' })
  content!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
