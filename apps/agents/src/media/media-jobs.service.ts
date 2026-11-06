import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { asRecord, optionalString, rpcFail } from '../common/rpc';
import { MediaJobEntity } from '../entities/media-job.entity';
import { TingwuClient } from './tingwu.client';

const BACKOFF_MS = [5_000, 10_000, 20_000, 40_000, 60_000];
const MAX_AGE_MS = 4 * 60 * 60 * 1000;
const POLL_BATCH = 10;

@Injectable()
export class MediaJobsService {
  private readonly refreshing = new Map<string, Promise<void>>();

  constructor(
    @InjectRepository(MediaJobEntity) private readonly jobs: Repository<MediaJobEntity>,
    private readonly dataSource: DataSource,
    private readonly tingwu: TingwuClient,
  ) {}

  async submitTingwu(input: {
    bizCode: string;
    accountId?: string;
    kind: 'speech' | 'video';
    fileUrl: string;
    mime?: string;
  }): Promise<{ jobId: string; status: string; provider: 'tingwu' }> {
    if (!this.tingwu.configured()) {
      rpcFail(503, '未配置通义听悟（TINGWU_APP_KEY 与阿里云 AccessKey），无法处理长音频或视频');
    }
    const id = randomBytes(12).toString('base64url').slice(0, 16);
    const job = await this.jobs.save(
      this.jobs.create({
        id,
        bizCode: input.bizCode,
        accountId: input.accountId ?? null,
        kind: input.kind,
        provider: 'tingwu',
        status: 'queued',
        sourceUrl: input.fileUrl,
        sourceMime: input.mime ?? null,
        nextPollAt: new Date(),
        pollCount: 0,
        result: null,
        errorMessage: null,
        finishedAt: null,
      }),
    );
    try {
      const created = await this.tingwu.createOfflineTask({
        fileUrl: input.fileUrl,
        kind: input.kind,
        taskKey: job.id,
      });
      await this.jobs.update(job.id, {
        status: 'submitted',
        upstreamTaskId: created.taskId,
        nextPollAt: new Date(Date.now() + BACKOFF_MS[0]),
      });
      return { jobId: job.id, status: 'submitted', provider: 'tingwu' };
    } catch (error) {
      const message = error instanceof Error ? error.message : '听悟创建任务失败';
      await this.jobs.update(job.id, {
        status: 'failed',
        errorMessage: message,
        finishedAt: new Date(),
      });
      rpcFail(502, message);
    }
  }

  async getJob(payload: unknown) {
    const body = asRecord(payload);
    const id = optionalString(body.id);
    const bizCode = optionalString(body._bizCode);
    if (!id) rpcFail(400, '缺少任务编号');
    if (!bizCode) rpcFail(400, '缺少业务标识');
    const job = await this.jobs.findOne({ where: { id, bizCode } });
    if (!job) rpcFail(404, '任务不存在');
    if (this.shouldRefresh(job)) {
      try {
        await this.refresh(job);
      } catch {
        // pollOne 已把失败记在任务上，查询仍返回当前进度。
      }
      const fresh = await this.jobs.findOne({ where: { id, bizCode } });
      if (fresh) return publicJob(fresh);
    }
    return publicJob(job);
  }

  private refresh(job: MediaJobEntity): Promise<void> {
    const pending = this.refreshing.get(job.id);
    if (pending) return pending;
    const task = this.pollOne(job).finally(() => {
      this.refreshing.delete(job.id);
    });
    this.refreshing.set(job.id, task);
    return task;
  }

  /** 查询时顺手问一次听悟，避免只靠 20 秒定时轮询。 */
  private shouldRefresh(job: MediaJobEntity): boolean {
    if (!job.upstreamTaskId) return false;
    if (job.status !== 'submitted' && job.status !== 'polling') return false;
    const touched = job.updatedAt?.getTime() ?? 0;
    return Date.now() - touched >= 3_000;
  }

  async pollDue(): Promise<number> {
    const due = await this.claimDueJobs();
    for (const job of due) {
      await this.pollOne(job);
    }
    return due.length;
  }

  private async claimDueJobs(): Promise<MediaJobEntity[]> {
    const rows = (await this.dataSource.query(
      `
        UPDATE ag_media_jobs SET
          status = 'polling',
          next_poll_at = NOW() + interval '30 seconds',
          poll_count = poll_count + 1
        WHERE id IN (
          SELECT id FROM ag_media_jobs
          WHERE status IN ('submitted', 'polling')
            AND next_poll_at IS NOT NULL
            AND next_poll_at <= NOW()
          ORDER BY next_poll_at ASC
          LIMIT $1
          FOR UPDATE SKIP LOCKED
        )
        RETURNING *
      `,
      [POLL_BATCH],
    )) as Array<Record<string, unknown>>;
    return rows.map((row) => this.jobs.create(fromRow(row)));
  }

  private async pollOne(job: MediaJobEntity): Promise<void> {
    if (!job.upstreamTaskId) {
      await this.fail(job.id, '缺少听悟任务编号');
      return;
    }
    if (Date.now() - job.createdAt.getTime() > MAX_AGE_MS) {
      await this.fail(job.id, '听悟任务超时未完成');
      return;
    }
    try {
      const info = await this.tingwu.getTask(job.upstreamTaskId);
      if (info.status === 'COMPLETED') {
        if (!info.transcriptionUrl) {
          await this.fail(job.id, '听悟完成但没有转写结果');
          return;
        }
        const parsed = await this.tingwu.fetchTranscription(info.transcriptionUrl);
        await this.jobs.update(job.id, {
          status: 'done',
          result: {
            transcript: parsed.transcript,
            segments: parsed.segments,
            transcriptionUrl: info.transcriptionUrl,
          },
          errorMessage: null,
          finishedAt: new Date(),
          nextPollAt: null,
        });
        return;
      }
      if (info.status === 'FAILED' || info.status === 'INVALID') {
        await this.fail(job.id, info.errorMessage || '听悟任务失败');
        return;
      }
      const next = BACKOFF_MS[Math.min(Math.max(job.pollCount - 1, 0), BACKOFF_MS.length - 1)];
      await this.jobs.update(job.id, {
        status: 'polling',
        nextPollAt: new Date(Date.now() + next),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '听悟查询失败';
      const next = BACKOFF_MS[Math.min(Math.max(job.pollCount - 1, 0), BACKOFF_MS.length - 1)];
      if (job.pollCount >= 20) {
        await this.fail(job.id, message);
        return;
      }
      await this.jobs.update(job.id, {
        status: 'polling',
        nextPollAt: new Date(Date.now() + next),
        errorMessage: message,
      });
    }
  }

  private fail(id: string, message: string) {
    return this.jobs.update(id, {
      status: 'failed',
      errorMessage: message,
      finishedAt: new Date(),
      nextPollAt: null,
    });
  }
}

export function publicJob(job: MediaJobEntity) {
  const result = job.result ?? {};
  return {
    jobId: job.id,
    status: job.status,
    kind: job.kind,
    provider: job.provider,
    transcript: typeof result.transcript === 'string' ? result.transcript : '',
    segments: Array.isArray(result.segments) ? result.segments : [],
    error: job.errorMessage ?? undefined,
    createdAt: job.createdAt,
    finishedAt: job.finishedAt,
  };
}

function fromRow(row: Record<string, unknown>): Partial<MediaJobEntity> {
  return {
    id: String(row.id),
    bizCode: String(row.biz_code),
    accountId: row.account_id ? String(row.account_id) : null,
    kind: row.kind as MediaJobEntity['kind'],
    provider: row.provider as MediaJobEntity['provider'],
    status: row.status as MediaJobEntity['status'],
    sourceUrl: row.source_url ? String(row.source_url) : null,
    sourceMime: row.source_mime ? String(row.source_mime) : null,
    upstreamTaskId: row.upstream_task_id ? String(row.upstream_task_id) : null,
    nextPollAt: row.next_poll_at ? new Date(String(row.next_poll_at)) : null,
    pollCount: Number(row.poll_count ?? 0),
    result: (row.result as Record<string, unknown> | null) ?? null,
    errorMessage: row.error_message ? String(row.error_message) : null,
    createdAt: new Date(String(row.created_at)),
    updatedAt: row.updated_at ? new Date(String(row.updated_at)) : new Date(),
    finishedAt: row.finished_at ? new Date(String(row.finished_at)) : null,
  };
}
