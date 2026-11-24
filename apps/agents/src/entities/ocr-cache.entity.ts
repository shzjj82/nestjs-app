import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/** 同一图片地址只识别一次。模型名变了才会重算。 */
@Entity('ag_ocr_cache')
export class OcrCacheEntity {
  @PrimaryColumn({ name: 'url_hash', type: 'varchar', length: 64 })
  urlHash: string;

  @Column({ type: 'text' })
  url: string;

  @Column({ type: 'text' })
  text: string;

  @Column({ type: 'varchar', length: 64 })
  model: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
