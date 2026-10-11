import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { RecycleCartridgeTypeEntity } from './recycle-cartridge-type.entity';

/**
 * 品牌字典：一行挂在一个 typeId 下。
 * 同一品牌既做墨盒也做硒鼓，所以唯一键是 (typeId, brand)。
 */
@Entity('recycle_brands')
@Index(['typeId', 'brand'], { unique: true })
@Index(['typeId'])
export class RecycleBrandEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'type_id', type: 'uuid' })
  typeId: string;

  @ManyToOne(() => RecycleCartridgeTypeEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'type_id' })
  typeRef?: RecycleCartridgeTypeEntity;

  @Column({ type: 'varchar', length: 64 })
  brand: string;

  @Column({ type: 'varchar', length: 512, default: '' })
  logo: string;

  @Column({ name: 'sort', type: 'int', default: 0 })
  sort: number;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;
}
