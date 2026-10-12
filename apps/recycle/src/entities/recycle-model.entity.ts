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
import { RecycleBrandEntity } from './recycle-brand.entity';
import { RecycleCartridgeTypeEntity } from './recycle-cartridge-type.entity';

/**
 * 型号字典 + 回收指导价。
 * 关联用 typeId / brandId；name 只是展示。
 */
@Entity('recycle_models')
@Index(['brandId', 'name'], { unique: true })
@Index(['typeId', 'brandId'])
export class RecycleModelEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'type_id', type: 'uuid' })
  typeId: string;

  @ManyToOne(() => RecycleCartridgeTypeEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'type_id' })
  typeRef?: RecycleCartridgeTypeEntity;

  @Column({ name: 'brand_id', type: 'uuid' })
  brandId: string;

  @ManyToOne(() => RecycleBrandEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'brand_id' })
  brandRef?: RecycleBrandEntity;

  @Column({ type: 'varchar', length: 64 })
  name: string;

  @Column({ type: 'varchar', length: 64, default: '' })
  spec: string;

  @Column({ type: 'varchar', length: 255, default: '' })
  fits: string;

  @Column({ type: 'boolean', default: false })
  chip: boolean;

  @Column({ type: 'int', default: 0 })
  price: number;

  @Column({ name: 'sort', type: 'int', default: 0 })
  sort: number;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
