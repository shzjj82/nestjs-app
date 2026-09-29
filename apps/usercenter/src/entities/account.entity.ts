import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ClientEntity } from './client.entity';
import { UserEntity } from './user.entity';

export type AccountType = 'password' | 'wechat_mp' | 'alipay_mp';

/** 登录账户：一个用户可关联多个账户，角色挂在账户上 */
@Entity('uc_accounts')
@Index(['type', 'clientId', 'identifier'], {
  unique: true,
  where: 'client_id IS NOT NULL',
})
@Index(['type', 'identifier'], { unique: true, where: 'client_id IS NULL' })
@Index(['userId'])
export class AccountEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 32 })
  type: AccountType;

  /** password：登录名；wechat_mp：openid；alipay_mp：支付宝 userId */
  @Column({ type: 'varchar', length: 128 })
  identifier: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 128, nullable: true })
  passwordHash: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  unionid: string | null;

  /** 小程序 openid 按小程序隔离；账密账户为空 */
  @Column({ name: 'client_id', type: 'uuid', nullable: true })
  clientId: string | null;

  @Column({ type: 'smallint', default: 1 })
  status: number;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @ManyToOne(() => ClientEntity, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'client_id' })
  client: ClientEntity | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt: Date;
}
