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

export type IdentityProvider = 'wechat_mp' | 'alipay_mp';

@Entity('uc_identities')
@Index(['clientId', 'provider', 'identifier'], { unique: true })
export class UserIdentityEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'client_id', type: 'uuid' })
  clientId: string;

  @Column({ type: 'varchar', length: 32 })
  provider: IdentityProvider;

  @Column({ type: 'varchar', length: 128 })
  identifier: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  unionid: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @ManyToOne(() => ClientEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id' })
  client: ClientEntity;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;
}
