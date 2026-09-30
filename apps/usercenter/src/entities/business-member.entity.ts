import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BusinessEntity } from './business.entity';
import { UserEntity } from './user.entity';

@Entity('uc_business_members')
@Index(['businessId', 'userId'], { unique: true })
@Index(['userId'])
export class BusinessMemberEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'business_id', type: 'uuid' })
  businessId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'smallint', default: 1 })
  status: number;

  @ManyToOne(() => BusinessEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: BusinessEntity;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;
}
