import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('doc_site')
export class SiteEntity {
  @PrimaryColumn({ type: 'int' })
  id: number;

  @Column({ name: 'about_name', type: 'varchar', length: 200 })
  aboutName: string;

  @Column({ name: 'about_body', type: 'jsonb' })
  aboutBody: Record<string, unknown>;

  @Column({ name: 'about_avatar', type: 'varchar', length: 500, default: '' })
  aboutAvatar: string;

  @Column({ type: 'jsonb', default: [] })
  skills: unknown[];
}
