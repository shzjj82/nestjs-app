import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AUDIT_RESULT_ENUM_NAME, AuditResult } from '../domain';
import { RecycleOrderEntity } from './recycle-order.entity';

/** 验收（审核）报告：验收员评估时生成，客户可在审核详情页查看 */
@Entity('recycle_audit_reports')
@Index(['orderId'], { unique: true })
export class RecycleAuditReportEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @ManyToOne(() => RecycleOrderEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order?: RecycleOrderEntity;

  @Column({
    type: 'enum',
    enum: AuditResult,
    enumName: AUDIT_RESULT_ENUM_NAME,
  })
  result: AuditResult;

  /** 验收项勾选结果 */
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  items: Array<{ name: string; pass: boolean; note?: string }>;

  /** 给客户看的备注 */
  @Column({ type: 'text', nullable: true })
  note: string | null;

  /** 内部结论，不对外展示 */
  @Column({ name: 'internal_note', type: 'text', nullable: true })
  internalNote: string | null;

  /** 建议回收价（分） */
  @Column({ name: 'suggested_price', type: 'int', nullable: true })
  suggestedPrice: number | null;

  /** 收货实拍图 */
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  photos: string[];

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;
}
