import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { TeamRole } from '@app/common';
import { AccountEntity } from './account.entity';
import { TeamEntity } from './team.entity';

/** 团队成员挂在账户上，不挂在用户上 */
@Entity('uc_team_members')
@Index(['teamId', 'accountId'], { unique: true })
@Index(['accountId'])
export class TeamMemberEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'team_id', type: 'uuid' })
  teamId: string;

  @Column({ name: 'account_id', type: 'uuid' })
  accountId: string;

  /** owner 拥有者 / developer 开发者 / user 使用者 */
  @Column({ type: 'varchar', length: 16 })
  role: TeamRole;

  @ManyToOne(() => TeamEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_id' })
  team: TeamEntity;

  @ManyToOne(() => AccountEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account: AccountEntity;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;
}
