import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  CartridgeType,
  ORDER_STATUS_ENUM_NAME,
  OrderSnapshot,
  OrderStatus,
} from '../domain';

/**
 * 回收订单聚合根。
 *
 * status 使用数据库原生枚举 `recycle_order_status`（见迁移文件），
 * 非法状态在数据库层就会被拒绝，不依赖应用层的校验。
 */
@Entity('recycle_orders')
@Index(['bizCode', 'status'])
@Index(['bizCode', 'ownerId'])
export class RecycleOrderEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** 对外展示的订单号 */
  @Index({ unique: true })
  @Column({ name: 'code', type: 'varchar', length: 32 })
  code: string;

  /** 业务隔离键，来自网关校验后的 _bizCode */
  @Column({ name: 'biz_code', type: 'varchar', length: 64 })
  bizCode: string;

  /** C 端客户 userId */
  @Column({ name: 'owner_id', type: 'uuid' })
  ownerId: string;

  @Index()
  @Column({ name: 'owner_openid', type: 'varchar', length: 64, nullable: true })
  ownerOpenid: string | null;

  /**
   * 下单时所用小程序的 appId。
   * 发订阅消息时靠它定位小程序（进而拿到模板 ID）；不存的话通知时无从下手。
   */
  @Column({ name: 'wechat_app_id', type: 'varchar', length: 64, nullable: true })
  wechatAppId: string | null;

  /** 负责该单的业务员；null 表示待领取 */
  @Column({ name: 'assigned_agent_id', type: 'uuid', nullable: true })
  assignedAgentId: string | null;

  /** 片区，用于验收员 / 业务员的行级数据范围 */
  @Column({ name: 'region_code', type: 'varchar', length: 32, nullable: true })
  regionCode: string | null;

  @Index()
  @Column({
    type: 'enum',
    enum: OrderStatus,
    enumName: ORDER_STATUS_ENUM_NAME,
    default: OrderStatus.DRAFT,
  })
  status: OrderStatus;

  /** 乐观锁：状态变更必须带上版本号，防止并发双写 */
  @Column({ name: 'version', type: 'int', default: 0 })
  version: number;

  // ---- 汇总展示字段，取明细首项，避免列表页回表明细 ----
  @Column({ name: 'brand', type: 'varchar', length: 64, default: '' })
  brand: string;

  @Column({ name: 'model', type: 'varchar', length: 64, default: '' })
  model: string;

  @Column({ name: 'spec', type: 'varchar', length: 128, nullable: true })
  spec: string | null;

  @Column({
    name: 'cartridge_type',
    type: 'varchar',
    length: 16,
    nullable: true,
  })
  cartridgeType: CartridgeType | null;

  @Column({ name: 'total_quantity', type: 'int', default: 0 })
  totalQuantity: number;

  // ---- 金额，统一单位：分 ----
  /** 整单预估回收价 = Σ 单支价 × 数量 */
  @Column({ name: 'estimate_price', type: 'int', default: 0 })
  estimatePrice: number;

  /** 验收员报价 */
  @Column({ name: 'b_offer_price', type: 'int', nullable: true })
  bOfferPrice: number | null;

  /** 客户协商价 */
  @Column({ name: 'negotiate_price', type: 'int', nullable: true })
  negotiatePrice: number | null;

  /** 最终成交价 */
  @Column({ name: 'final_price', type: 'int', nullable: true })
  finalPrice: number | null;

  // ---- 备注：对外 / 对内分开，字段级权限在出口裁剪 ----
  /** 验收备注，客户可见 */
  @Column({ name: 'b_eval_note', type: 'text', nullable: true })
  bEvalNote: string | null;

  /** 内部备注，仅业务员 / 验收员 / 审批员可见 */
  @Column({ name: 'internal_note', type: 'text', nullable: true })
  internalNote: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  screenshots: string[];

  @Column({ name: 'logistics_no', type: 'varchar', length: 64, default: '' })
  logisticsNo: string;

  @Column({
    name: 'logistics_company',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  logisticsCompany: string | null;

  @Column({
    name: 'return_logistics_no',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  returnLogisticsNo: string | null;

  /** 商户转账单号 out_bill_no；仅财务可写 */
  @Column({
    name: 'transfer_bill_no',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  transferBillNo: string | null;

  /** 微信转账单号 transfer_bill_no */
  @Column({
    name: 'transfer_wx_bill_no',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  transferWxBillNo: string | null;

  /**
   * 跳转确认收款页的 package_info。
   * 仅 WAIT_USER_CONFIRM 时有值；给小程序 wx.requestMerchantTransfer 用。
   */
  @Column({ name: 'transfer_package_info', type: 'text', nullable: true })
  transferPackageInfo: string | null;

  /** 微信转账单据状态：WAIT_USER_CONFIRM / SUCCESS / FAIL … */
  @Column({
    name: 'transfer_state',
    type: 'varchar',
    length: 32,
    nullable: true,
  })
  transferState: string | null;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @Index()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

/** 实体 → 策略引擎快照，避免策略层依赖 ORM */
export function toOrderSnapshot(entity: RecycleOrderEntity): OrderSnapshot {
  return {
    id: entity.id,
    bizCode: entity.bizCode,
    status: entity.status,
    ownerId: entity.ownerId,
    assignedAgentId: entity.assignedAgentId,
    regionCode: entity.regionCode,
    estimatePrice: entity.estimatePrice,
    bOfferPrice: entity.bOfferPrice,
    negotiatePrice: entity.negotiatePrice,
    finalPrice: entity.finalPrice,
    version: entity.version,
  };
}
