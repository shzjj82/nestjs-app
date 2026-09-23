import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('uc_permissions')
@Index(['appId', 'code'], { unique: true })
export class PermissionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'app_id', type: 'varchar', length: 64 })
  appId: string;

  @Column({ type: 'varchar', length: 64, default: '默认' })
  module: string;

  @Column({ type: 'varchar', length: 64 })
  code: string;

  @Column({ type: 'varchar', length: 64 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @Column({ type: 'int', default: 0 })
  sort: number;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;
}
