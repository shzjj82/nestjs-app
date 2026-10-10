import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ORDER_STATUS_ENUM_NAME, OrderStatus } from '../domain';
import { RecycleOrderEntity } from './recycle-order.entity';

/**
 * 订单事件流。
 *
 * 同时承担两个职责：
 *  1. C 端时间轴展示；
 *  2. 审计留痕 —— 谁、在什么身份下、把订单从哪个状态推到了哪个状态。
 */
@Entity('recycle_order_events')
@Index(['orderId', 'createdAt'])
export class RecycleOrderEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @ManyToOne(() => RecycleOrderEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order?: RecycleOrderEntity;

  @Column({ name: 'biz_code', type: 'varchar', length: 64 })
  bizCode: string;

  @Column({ type: 'varchar', length: 32 })
  action: string;

  @Column({
    name: 'from_status',
    type: 'enum',
    enum: OrderStatus,
    enumName: ORDER_STATUS_ENUM_NAME,
    nullable: true,
  })
  fromStatus: OrderStatus | null;

  @Column({
    name: 'to_status',
    type: 'enum',
    enum: OrderStatus,
    enumName: ORDER_STATUS_ENUM_NAME,
  })
  toStatus: OrderStatus;

  /** 操作人 userId；系统/内部事件可为空 */
  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId: string | null;

  /** 操作时的角色快照，事后追责用 */
  @Column({ name: 'actor_roles', type: 'jsonb', default: () => "'[]'::jsonb" })
  actorRoles: string[];

  @Column({ type: 'varchar', length: 200, nullable: true })
  title: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  /** 动作载荷摘要（不含敏感字段） */
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  payload: Record<string, unknown>;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;
}
