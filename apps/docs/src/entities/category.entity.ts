import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('doc_categories')
export class CategoryEntity {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  slug: string;

  @Column({ type: 'varchar', length: 32 })
  name: string;

  @Column({ type: 'varchar', length: 128, default: '' })
  hint: string;

  @Column({ type: 'varchar', length: 32 })
  color: string;

  @Column({ type: 'varchar', length: 32, default: 'article' })
  kind: string;

  @Column({ type: 'boolean', default: true })
  nav: boolean;

  @Column({ type: 'int', default: 0 })
  sort: number;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
