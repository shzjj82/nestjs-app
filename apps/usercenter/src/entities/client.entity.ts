import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BusinessEntity } from './business.entity';

export type ClientType = 'web' | 'wechat_mp' | 'alipay_mp' | 'app';

/** 接入端：某个业务下的 Web / 小程序 / App 入口 */
@Entity('uc_clients')
export class ClientEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'business_id', type: 'uuid', nullable: true })
  businessId: string | null;

  @ManyToOne(() => BusinessEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'business_id' })
  business: BusinessEntity | null;

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
