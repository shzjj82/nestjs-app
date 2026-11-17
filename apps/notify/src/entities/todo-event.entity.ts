import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** 待办业务操作日志（只追加） */
@Entity('nt_todo_events')
@Index('ix_nt_todo_events_todo_created', ['todoId', 'createdAt'])
@Index('ix_nt_todo_events_biz_created', ['bizCode', 'createdAt'])
@Index('ix_nt_todo_events_actor', ['actorId', 'createdAt'])
export class TodoEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'biz_code', type: 'varchar', length: 64 })
  bizCode: string;

  @Column({ name: 'todo_id', type: 'uuid' })
  todoId: string;

  /** todo.create / todo.start / todo.done / ... */
  @Column({ type: 'varchar', length: 64 })
  action: string;

  @Column({ name: 'from_status', type: 'varchar', length: 16, nullable: true })
  fromStatus: string | null;

  @Column({ name: 'to_status', type: 'varchar', length: 16, nullable: true })
  toStatus: string | null;

  /** 操作人 userId；系统/cron 可空 */
  @Column({ name: 'actor_id', type: 'varchar', length: 64, nullable: true })
  actorId: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  title: string | null;

  @Column({ type: 'varchar', length: 16, default: 'success' })
  outcome: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  payload: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
