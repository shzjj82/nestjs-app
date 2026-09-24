import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type ClientType = 'web' | 'wechat_mp' | 'alipay_mp' | 'app';

@Entity('uc_clients')
export class ClientEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ name: 'app_code', type: 'varchar', length: 64 })
  appCode: string;

  @Column({ type: 'varchar', length: 64 })
  name: string;

  @Column({ type: 'varchar', length: 32, default: 'web' })
  type: ClientType;

  @Column({ name: 'wechat_app_id', type: 'varchar', length: 64, nullable: true })
  wechatAppId: string | null;

  @Column({ name: 'wechat_secret', type: 'varchar', length: 128, nullable: true })
  wechatSecret: string | null;

  @Column({ name: 'alipay_app_id', type: 'varchar', length: 64, nullable: true })
  alipayAppId: string | null;

  @Column({ name: 'alipay_private_key', type: 'text', nullable: true })
  alipayPrivateKey: string | null;

  @Column({ type: 'smallint', default: 1 })
  status: number;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt: Date;
}
