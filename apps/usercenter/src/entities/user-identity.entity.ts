import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AppEntity } from './app.entity';
import { UserEntity } from './user.entity';

@Entity('uc_user_identities')
@Index(['appPk', 'provider', 'openid'], { unique: true })
export class UserIdentityEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'app_pk', type: 'uuid' })
  appPk: string;

  @Column({ type: 'varchar', length: 32, default: 'wechat_mp' })
  provider: string;

  @Column({ type: 'varchar', length: 64 })
  openid: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  unionid: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @ManyToOne(() => AppEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'app_pk' })
  app: AppEntity;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;
}
