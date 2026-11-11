import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Wiki 团队：按接入端 appCode 与业务 code 隔离，成员挂在账户 id 上 */
@Entity('wiki_teams')
@Index(['appCode', 'bizCode'])
@Index(['appCode', 'bizCode', 'code'], { unique: true })
export class TeamEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'app_code', type: 'varchar', length: 64 })
  appCode!: string;

  @Column({ name: 'biz_code', type: 'varchar', length: 64 })
  bizCode!: string;

  @Column({ type: 'varchar', length: 16 })
  code!: string;

  @Column({ type: 'varchar', length: 64 })
  name!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description!: string | null;

  @Column({ type: 'smallint', default: 1 })
  status!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
