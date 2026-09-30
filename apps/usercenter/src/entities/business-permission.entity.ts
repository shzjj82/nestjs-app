import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BusinessEntity } from './business.entity';
import { PermissionEntity } from './permission.entity';

/** 业务能力包：该业务下的角色只能生效这里列出的功能点 */
@Entity('uc_business_permissions')
@Index(['businessId', 'permissionId'], { unique: true })
export class BusinessPermissionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'business_id', type: 'uuid' })
  businessId: string;

  @Column({ name: 'permission_id', type: 'uuid' })
  permissionId: string;

  @ManyToOne(() => BusinessEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: BusinessEntity;

  @ManyToOne(() => PermissionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'permission_id' })
  permission: PermissionEntity;
}
