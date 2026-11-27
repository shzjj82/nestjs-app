import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** wiki 业务操作日志（只追加） */
@Entity('wiki_op_events')
@Index('ix_wiki_op_events_biz_created', ['bizCode', 'createdAt'])
@Index('ix_wiki_op_events_resource', ['resourceType', 'resourceId', 'createdAt'])
@Index('ix_wiki_op_events_actor', ['actorId', 'createdAt'])
export class WikiOpEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'biz_code', type: 'varchar', length: 64 })
  bizCode: string;

  /** 如 document.create / document.update / document.delete */
  @Column({ type: 'varchar', length: 64 })
  action: string;

  /** 如 document / team / share */
  @Column({ name: 'resource_type', type: 'varchar', length: 32 })
  resourceType: string;

  @Column({ name: 'resource_id', type: 'varchar', length: 64 })
  resourceId: string;

  /** 操作人 accountId；系统任务可空 */
  @Column({ name: 'actor_id', type: 'varchar', length: 64, nullable: true })
  actorId: string | null;

  @Column({ name: 'actor_user_id', type: 'varchar', length: 64, nullable: true })
  actorUserId: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  title: string | null;

  @Column({ type: 'varchar', length: 16, default: 'success' })
  outcome: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  payload: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
