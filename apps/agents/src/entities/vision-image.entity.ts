import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('ag_vision_images')
@Index(['jobId'])
export class VisionImageEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ name: 'job_id', type: 'varchar', length: 64 })
  jobId: string;

  @Column({ type: 'text' })
  url: string;

  @Column({ type: 'text' })
  key: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;
}
