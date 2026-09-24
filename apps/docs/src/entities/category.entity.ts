import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('doc_categories')
@Index('uq_doc_categories_app_slug', ['appCode', 'slug'], { unique: true })
export class CategoryEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Index()
  @Column({ name: 'app_code', type: 'varchar', length: 64, default: 'blog' })
  appCode!: string;

  @Column({ type: 'varchar', length: 64 })
  slug!: string;

  @Column({ type: 'varchar', length: 32 })
  name!: string;

  @Column({ type: 'varchar', length: 128, default: '' })
  hint!: string;

  @Column({ type: 'varchar', length: 32 })
  color!: string;

  @Column({ type: 'varchar', length: 32, default: 'article' })
  kind!: string;

  @Column({ type: 'boolean', default: true })
  nav!: boolean;

  @Column({ type: 'int', default: 0 })
  sort!: number;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
