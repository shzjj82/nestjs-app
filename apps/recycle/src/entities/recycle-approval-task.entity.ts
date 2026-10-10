import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import {
  APPROVAL_STATUS_ENUM_NAME,
  APPROVAL_TYPE_ENUM_NAME,
  ApprovalStatus,
  ApprovalType,
} from '../domain';

/**
 * 审批任务（待办）。
 *
 * 刻意与订单表分开：审批是「人做决策」的过程，订单状态是「货流到哪了」。
 * 分开后加会签、二级审批都不需要动订单表。
 */
@Entity('recycle_approval_tasks')
@Index(['bizCode', 'status'])
@Index(['orderId'])
export class RecycleApprovalTaskEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'biz_code', type: 'varchar', length: 64 })
  bizCode: string;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @Column({
    type: 'enum',
    enum: ApprovalType,
    enumName: APPROVAL_TYPE_ENUM_NAME,
  })
  type: ApprovalType;

  @Column({
    type: 'enum',
    enum: ApprovalStatus,
    enumName: APPROVAL_STATUS_ENUM_NAME,
    default: ApprovalStatus.PENDING,
  })
  status: ApprovalStatus;

  /** 需要的审批角色；指派优先看 assigneeId，未指派时按角色领取 */
  @Column({ name: 'assignee_role', type: 'varchar', length: 32 })
  assigneeRole: string;

  @Index()
  @Column({ name: 'assignee_id', type: 'uuid', nullable: true })
  assigneeId: string | null;

  /** 发起审批的人：用于职责分离校验，不能审自己发起的单 */
  @Column({ name: 'requested_by', type: 'uuid' })
  requestedBy: string;

  /** 审批上下文快照（报价、差价等），避免回查订单 */
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  payload: Record<string, unknown>;

  @Column({ name: 'decided_by', type: 'uuid', nullable: true })
  decidedBy: string | null;

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt: Date | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt: Date;
}
