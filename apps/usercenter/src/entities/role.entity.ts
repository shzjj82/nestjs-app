import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BusinessEntity } from './business.entity';

@Entity('uc_roles')
@Index(['code'], { unique: true, where: 'business_id IS NULL' })
@Index(['businessId', 'code'], { unique: true, where: 'business_id IS NOT NULL' })
export class RoleEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** 为空表示平台级角色，在所有业务中生效 */
  @Column({ name: 'business_id', type: 'uuid', nullable: true })
  businessId: string | null;

  @Column({ type: 'varchar', length: 64 })
  code: string;

  @Column({ type: 'varchar', length: 64 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @Column({ name: 'is_system', type: 'boolean', default: false })
  isSystem: boolean;

  @ManyToOne(() => BusinessEntity, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'business_id' })
  business: BusinessEntity | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;
}
