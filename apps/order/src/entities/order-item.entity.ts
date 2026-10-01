import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { OrderEntity } from './order.entity';

@Entity('od_order_items')
@Index(['orderId'])
export class OrderItemEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ name: 'order_id', type: 'varchar', length: 64 })
  orderId: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  /** 单价，单位分 */
  @Column({ type: 'int', default: 0 })
  price: number;

  /** 行金额，单位分 */
  @Column({ type: 'int', default: 0 })
  amount: number;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @ManyToOne(() => OrderEntity, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: OrderEntity;
}
