import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { CartridgeType } from '../domain';

/**
 * 品牌字典：一行 = 一个「品牌 × 类型」组合。
 *
 * 同一个品牌既做墨盒也做硒鼓（惠普 / 佳能 / 兄弟），
 * 所以唯一键是 (brand, type) 而不是 brand。
 */
@Entity('recycle_brands')
@Index(['brand', 'type'], { unique: true })
export class RecycleBrandEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** 品牌名，如「惠普 HP」 */
  @Column({ type: 'varchar', length: 64 })
  brand: string;

  @Column({ type: 'varchar', length: 16 })
  type: CartridgeType;

  /**
   * 品牌 logo 地址。
   * 当前暂不上 logo（恒为空串，前端降级为文字占位块）；
   * 以后要上时直接把 CDN URL 写进这一列，接口与前端都不用改。
   */
  @Column({ type: 'varchar', length: 512, default: '' })
  logo: string;

  @Column({ name: 'sort', type: 'int', default: 0 })
  sort: number;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;
}
