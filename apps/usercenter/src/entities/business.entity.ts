import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** 业务：博客、wiki 等；数据按业务 code 隔离，角色与成员归属业务 */
@Entity('uc_businesses')
export class BusinessEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  code: string;

  @Column({ type: 'varchar', length: 64 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @Column({ type: 'smallint', default: 1 })
  status: number;

  /** 已开通的业务接口，如 `POST /auth/register` */
  @Column({ type: 'text', array: true, default: () => "'{}'" })
  apis: string[];

  /** 首次登录自动加入时授予的角色；为空则只加入不授角色 */
  @Column({ name: 'default_role_id', type: 'uuid', nullable: true })
  defaultRoleId: string | null;

  @Column({ name: 'is_system', type: 'boolean', default: false })
  isSystem: boolean;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt: Date;
}
