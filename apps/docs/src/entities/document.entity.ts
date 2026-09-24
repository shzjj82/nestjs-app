import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { CategoryEntity } from './category.entity';

/**
 * 通用文档。用 appCode 隔离应用，kind 只表示形态。
 */
@Entity('doc_documents')
@Index('uq_doc_documents_app_slug', ['appCode', 'slug'], { unique: true })
export class DocumentEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Index()
  @Column({ name: 'app_code', type: 'varchar', length: 64, default: 'blog' })
  appCode!: string;

  @Column({ type: 'varchar', length: 80 })
  slug!: string;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  /** 文档形态：article / about */
  @Index()
  @Column({ type: 'varchar', length: 32, default: 'article' })
  kind!: string;

  /** 该应用下的分类 slug，与 categoryId 同步，方便按 slug 查 */
  @Index()
  @Column({ type: 'varchar', length: 64, default: '' })
  category!: string;

  @Column({ name: 'category_id', type: 'uuid', nullable: true })
  categoryId!: string | null;

  @ManyToOne(() => CategoryEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'category_id' })
  categoryRef?: CategoryEntity | null;

  @Index()
  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId!: string | null;

  @ManyToOne(() => DocumentEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'parent_id' })
  parent?: DocumentEntity | null;

  @Column({ name: 'tree_sort', type: 'int', default: 0 })
  treeSort!: number;

  @Column({ type: 'text', default: '' })
  summary!: string;

  @Column({ name: 'cover_url', type: 'varchar', length: 500, default: '' })
  coverUrl!: string;

  @Column({ type: 'jsonb', default: {} })
  props!: Record<string, unknown>;

  @Column({ name: 'body_format', type: 'varchar', length: 32, default: 'editorjs' })
  bodyFormat!: string;

  @Column({ type: 'jsonb' })
  body!: Record<string, unknown>;

  @Column({ name: 'author_id', type: 'uuid', nullable: true })
  authorId!: string | null;

  @Column({ type: 'boolean', default: true })
  draft!: boolean;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
