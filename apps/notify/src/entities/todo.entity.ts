import type { NotifyTodoStatus } from '@app/notify-contract';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('nt_todos')
@Index('ix_nt_todos_inbox', ['bizCode', 'userId', 'createdAt'])
export class TodoEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'biz_code', type: 'varchar', length: 64 })
  bizCode: string;

  @Column({ name: 'user_id', type: 'varchar', length: 64 })
  userId: string;

  @Column({ type: 'varchar', length: 120 })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'varchar', length: 64, default: 'system' })
  category: string;

  @Column({ type: 'varchar', length: 64, default: 'system' })
  source: string;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status: NotifyTodoStatus;

  @Column({ type: 'jsonb', nullable: true })
  data: Record<string, unknown> | null;

  /** 开始日 YYYY-MM-DD */
  @Column({ name: 'starts_at', type: 'date', nullable: true })
  startsAt: string | null;

  @Column({ name: 'due_at', type: 'timestamptz', nullable: true })
  dueAt: Date | null;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt: Date | null;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  @Column({ name: 'started_notice_at', type: 'timestamptz', nullable: true })
  startedNoticeAt: Date | null;

  /** 上次进度问询日 YYYY-MM-DD */
  @Column({ name: 'last_progress_notice_on', type: 'date', nullable: true })
  lastProgressNoticeOn: string | null;

  /** 上次催办日 YYYY-MM-DD */
  @Column({ name: 'last_overdue_notice_on', type: 'date', nullable: true })
  lastOverdueNoticeOn: string | null;

  /** 旧版「截止日当天」提醒占位，保留兼容非 wiki 到期提醒 */
  @Column({ name: 'reminded_on', type: 'date', nullable: true })
  remindedOn: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
