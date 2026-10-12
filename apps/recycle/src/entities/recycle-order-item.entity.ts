import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CartridgeType } from '../domain';
import { RecycleOrderEntity } from './recycle-order.entity';

/** 订单明细：一次回收可含多个不同品牌 / 类型的空墨盒、空硒鼓 */
@Entity('recycle_order_items')
@Index(['orderId'])
export class RecycleOrderItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @ManyToOne(() => RecycleOrderEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order?: RecycleOrderEntity;

  @Column({ name: 'type_id', type: 'uuid', nullable: true })
  typeId: string | null;

  @Column({ name: 'brand_id', type: 'uuid', nullable: true })
  brandId: string | null;

  @Column({ name: 'model_id', type: 'uuid', nullable: true })
  modelId: string | null;

  @Column({ name: 'cartridge_type', type: 'varchar', length: 16 })
  cartridgeType: CartridgeType;

  @Column({ type: 'varchar', length: 64 })
  brand: string;

  @Column({ type: 'varchar', length: 64 })
  model: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  spec: string | null;

  /** 是否原装带芯片 */
  @Column({ type: 'boolean', default: false })
  chip: boolean;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  /** 单支预估回收价（分） */
  @Column({ type: 'int', default: 0 })
  price: number;

  @Column({ name: 'sort', type: 'int', default: 0 })
  sort: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
