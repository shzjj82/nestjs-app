import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { RecycleApprovalTaskEntity } from './recycle-approval-task.entity';

/**
 * 审批记录（留痕）。
 *
 * 与任务分开的原因：协商可以来回多轮（reprice → 客户再协商 → 再审批），
 * 一个任务下会有多条决策记录，任务只保留最终结论。
 */
@Entity('recycle_approval_records')
@Index(['taskId', 'createdAt'])
@Index(['orderId'])
export class RecycleApprovalRecordEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'task_id', type: 'uuid' })
  taskId: string;

  @ManyToOne(() => RecycleApprovalTaskEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task?: RecycleApprovalTaskEntity;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @Column({ name: 'actor_id', type: 'uuid' })
  actorId: string;

  @Column({ name: 'actor_roles', type: 'jsonb', default: () => "'[]'::jsonb" })
  actorRoles: string[];

  /** accept | reject | reprice */
  @Column({ type: 'varchar', length: 16 })
  decision: string;

  /** reprice 时的新报价（分） */
  @Column({ type: 'int', nullable: true })
  price: number | null;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;
}
