import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('wx_miniprograms')
export class MiniProgramEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  code: string;

  @Column({ type: 'varchar', length: 64 })
  name: string;

  @Index({ unique: true })
  @Column({ name: 'app_id', type: 'varchar', length: 64 })
  appId: string;

  @Column({ type: 'varchar', length: 128 })
  secret: string;

  @Column({ type: 'smallint', default: 1 })
  status: number;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt: Date;
}
