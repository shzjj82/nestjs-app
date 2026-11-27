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
import { RecycleStoreEntity } from './recycle-store.entity';

/** 门店 ↔ 回收业务账号 */
@Entity('recycle_store_staff')
@Index(['storeId', 'accountId'], { unique: true })
@Index(['bizCode', 'accountId'])
export class RecycleStoreStaffEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'biz_code', type: 'varchar', length: 64 })
  bizCode: string;

  @Column({ name: 'store_id', type: 'uuid' })
  storeId: string;

  @ManyToOne(() => RecycleStoreEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store?: RecycleStoreEntity;

  @Column({ name: 'account_id', type: 'varchar', length: 64 })
  accountId: string;

  @Column({ name: 'user_id', type: 'varchar', length: 64 })
  userId: string;

  /** 门店侧展示别名（不改账户本身） */
  @Column({ type: 'varchar', length: 64, default: '' })
  alias: string;

  /** 绑定时间（创建时间） */
  @CreateDateColumn({ name: 'bound_at', type: 'timestamptz' })
  boundAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
