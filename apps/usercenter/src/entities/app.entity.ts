import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('uc_apps')
export class AppEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ name: 'app_id', type: 'varchar', length: 64 })
  appId: string;

  @Column({ type: 'varchar', length: 64 })
  name: string;

  @Column({ type: 'varchar', length: 32, default: 'web' })
  type: 'web' | 'miniprogram' | 'app';

  @Column({ name: 'wechat_app_id', type: 'varchar', length: 64, nullable: true })
  wechatAppId: string | null;

  @Column({ name: 'wechat_secret', type: 'varchar', length: 128, nullable: true })
  wechatSecret: string | null;

  @Column({ type: 'smallint', default: 1 })
  status: number;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt: Date;
}
