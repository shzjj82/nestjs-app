import { Column, Entity, PrimaryColumn } from 'typeorm';
import { CartridgeType } from '../domain';

/**
 * 耗材类型字典（墨盒 / 硒鼓）。
 *
 * 主键直接用类型 key，不额外发 uuid —— 类型是稳定的枚举值，
 * 前端拿到的 `key` 与订单明细里的 `cartridge_type` 是同一个东西。
 */
@Entity('recycle_cartridge_types')
export class RecycleCartridgeTypeEntity {
  @PrimaryColumn({ type: 'varchar', length: 16 })
  key: CartridgeType;

  /** 展示名，如「墨盒」 */
  @Column({ type: 'varchar', length: 32 })
  label: string;

  /** 一句话说明，如「喷墨打印机空墨盒」 */
  @Column({ name: 'description', type: 'varchar', length: 128, default: '' })
  desc: string;

  /** 主题色（前端直接消费，避免前端再维护一份色值） */
  @Column({ type: 'varchar', length: 16, default: '#3b82f6' })
  color: string;

  @Column({ name: 'sort', type: 'int', default: 0 })
  sort: number;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;
}
