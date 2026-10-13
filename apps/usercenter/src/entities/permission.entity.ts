import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('uc_permissions')
export class PermissionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** platform：角色勾选；business：业务开通模块 */
  @Column({ type: 'varchar', length: 16, default: 'platform' })
  scope: 'platform' | 'business';

  @Column({ type: 'varchar', length: 64, default: '默认' })
  module: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  code: string;

  @Column({ type: 'varchar', length: 64 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @Column({ type: 'int', default: 0 })
  sort: number;

  /** 绑定的网关接口键，如 `GET /users` */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  apis: string[];

  /** 仅超级管理员：不展示、不可分配给其他角色 */
  @Column({ name: 'admin_only', type: 'boolean', default: false })
  adminOnly: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
