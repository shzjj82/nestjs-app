import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** 团队：按接入端 appCode 与业务 code 隔离，成员挂在账户上 */
@Entity('uc_teams')
@Index(['appCode', 'bizCode'])
export class TeamEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** 接入端 appCode，与登录会话 appId 一致 */
  @Column({ name: 'app_code', type: 'varchar', length: 64 })
  appCode: string;

  /** 业务 code，与文档 appCode / X-Biz-Code 一致 */
  @Column({ name: 'biz_code', type: 'varchar', length: 64 })
  bizCode: string;

  @Column({ type: 'varchar', length: 64 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @Column({ type: 'smallint', default: 1 })
  status: number;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt: Date;
}
