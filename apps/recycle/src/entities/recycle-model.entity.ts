import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { CartridgeType } from '../domain';

/**
 * 型号字典 + 回收指导价（唯一权威价源）。
 *
 * ⚠️ 客户端上报的单价一律不可信：下单与估价都以本表的 price 为准，
 * 客户端只申报「是什么、多少支」。
 */
@Entity('recycle_models')
@Index(['type', 'brand', 'name'], { unique: true })
@Index(['type', 'brand'])
export class RecycleModelEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 16 })
  type: CartridgeType;

  /** 所属品牌（冗余自 recycle_brands.brand，便于扁平返回与过滤） */
  @Column({ type: 'varchar', length: 64 })
  brand: string;

  /** 型号名，如「HP 803 黑色」 */
  @Column({ type: 'varchar', length: 64 })
  name: string;

  /** 规格：黑色 / 彩色 / 四色套装 / 大容量 … */
  @Column({ type: 'varchar', length: 64, default: '' })
  spec: string;

  /** 适用机型示例 */
  @Column({ type: 'varchar', length: 255, default: '' })
  fits: string;

  /** 是否原装带芯片（带芯片的空盒可再利用率高，报价更高） */
  @Column({ type: 'boolean', default: false })
  chip: boolean;

  /** 空耗材回收指导价（分） */
  @Column({ type: 'int', default: 0 })
  price: number;

  @Column({ name: 'sort', type: 'int', default: 0 })
  sort: number;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;
}
