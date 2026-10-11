import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { CartridgeType } from '../domain';

/**
 * 耗材类型字典（墨盒 / 硒鼓）。
 *
 * 关联一律用 `id`（前端的 typeId）。`key` 只是展示/种子用的稳定编码。
 */
@Entity('recycle_cartridge_types')
export class RecycleCartridgeTypeEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 16 })
  key: CartridgeType;

  @Column({ type: 'varchar', length: 32 })
  label: string;

  @Column({ name: 'description', type: 'varchar', length: 128, default: '' })
  desc: string;

  @Column({ type: 'varchar', length: 16, default: '#3b82f6' })
  color: string;

  @Column({ name: 'sort', type: 'int', default: 0 })
  sort: number;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;
}
