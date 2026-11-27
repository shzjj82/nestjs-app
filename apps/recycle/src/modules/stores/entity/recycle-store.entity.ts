import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** 回收门店（寄送/交投地址） */
@Entity('recycle_stores')
@Index(['bizCode', 'enabled'])
export class RecycleStoreEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'biz_code', type: 'varchar', length: 64 })
  bizCode: string;

  @Column({ type: 'varchar', length: 64 })
  name: string;

  @Column({ type: 'varchar', length: 32, default: '' })
  contact: string;

  @Column({ type: 'varchar', length: 32, default: '' })
  phone: string;

  @Column({ type: 'varchar', length: 32, default: '' })
  province: string;

  @Column({ type: 'varchar', length: 32, default: '' })
  city: string;

  @Column({ type: 'varchar', length: 32, default: '' })
  district: string;

  @Column({ type: 'varchar', length: 255, default: '' })
  address: string;

  @Column({ type: 'varchar', length: 16, default: '' })
  postal: string;

  @Column({ type: 'double precision', nullable: true })
  longitude: number | null;

  @Column({ type: 'double precision', nullable: true })
  latitude: number | null;

  @Index({ unique: true })
  @Column({ name: 'bind_scene', type: 'varchar', length: 32 })
  bindScene: string;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
