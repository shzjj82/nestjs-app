import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('doc_posts')
export class PostEntity {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 80 })
  slug: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'varchar', length: 64 })
  type: string;

  @Index()
  @Column({ name: 'page_kind', type: 'varchar', length: 16, default: 'article' })
  pageKind: string;

  @Index()
  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId: string | null;

  @Column({ name: 'tree_sort', type: 'int', default: 0 })
  treeSort: number;

  @Column({ type: 'text', default: '' })
  summary: string;

  @Column({ name: 'cover_url', type: 'varchar', length: 500, default: '' })
  coverUrl: string;

  @Column({ type: 'jsonb', default: {} })
  props: Record<string, unknown>;

  @Column({ type: 'jsonb' })
  body: Record<string, unknown>;

  @Column({ type: 'boolean', default: true })
  draft: boolean;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
