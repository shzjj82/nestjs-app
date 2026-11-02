import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export type MediaJobKind = 'speech' | 'video' | 'language';
export type MediaJobProvider = 'qwen_asr' | 'tingwu' | 'llm';
export type MediaJobStatus = 'queued' | 'submitted' | 'polling' | 'done' | 'failed';

@Entity('ag_media_jobs')
@Index(['bizCode', 'createdAt'])
@Index(['status', 'nextPollAt'])
export class MediaJobEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id: string;

  @Column({ name: 'biz_code', type: 'varchar', length: 64 })
  bizCode: string;

  @Column({ name: 'account_id', type: 'varchar', length: 64, nullable: true })
  accountId: string | null;

  @Column({ type: 'varchar', length: 16 })
  kind: MediaJobKind;

  @Column({ type: 'varchar', length: 16 })
  provider: MediaJobProvider;

  @Column({ type: 'varchar', length: 32, default: 'queued' })
  status: MediaJobStatus;

  @Column({ name: 'source_url', type: 'text', nullable: true })
  sourceUrl: string | null;

  @Column({ name: 'source_mime', type: 'varchar', length: 128, nullable: true })
  sourceMime: string | null;

  @Column({ name: 'upstream_task_id', type: 'varchar', length: 128, nullable: true })
  upstreamTaskId: string | null;

  @Column({ name: 'next_poll_at', type: 'timestamptz', nullable: true })
  nextPollAt: Date | null;

  @Column({ name: 'poll_count', type: 'int', default: 0 })
  pollCount: number;

  @Column({ type: 'jsonb', nullable: true })
  result: Record<string, unknown> | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt: Date | null;
}
