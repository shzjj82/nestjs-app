import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { objectKey } from '../common/object-key';
import { StorageService } from '../storage/storage.service';
import { JobsStore } from './jobs.store';

@Injectable()
export class JobsWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('UploadWorker');
  private running = false;

  constructor(
    private readonly store: JobsStore,
    private readonly storage: StorageService,
  ) {}

  onModuleInit() {
    this.running = true;
    void this.loop();
  }

  onModuleDestroy() {
    this.running = false;
  }

  private async loop() {
    while (this.running) {
      try {
        const id = await this.store.take(5);
        if (!id) {
          continue;
        }
        await this.handle(id);
      } catch (err) {
        this.logger.error(
          `队列消费失败: ${err instanceof Error ? err.message : String(err)}`,
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  private async handle(id: string) {
    const job = await this.store.getJob(id);
    if (!job) {
      this.logger.warn(`任务丢失 ${id}`);
      return;
    }
    const body = await this.store.readBlob(id);
    if (!body) {
      job.status = 'failed';
      job.error = '文件已过期，请重新上传';
      await this.store.saveJob(job);
      return;
    }
    job.status = 'uploading';
    await this.store.saveJob(job);
    try {
      const stored = await this.storage.put({
        key: objectKey(job.prefix, job.filename),
        body,
        contentType: job.contentType,
      });
      job.status = 'done';
      job.key = stored.key;
      job.url = stored.url;
      job.driver = stored.driver;
      job.size = stored.size;
      job.error = undefined;
      await this.store.saveJob(job);
      await this.store.dropBlob(id);
      this.logger.log(`异步上传完成 ${id} -> ${stored.key}`);
    } catch (err) {
      job.status = 'failed';
      job.error = err instanceof Error ? err.message : String(err);
      await this.store.saveJob(job);
      this.logger.error(`异步上传失败 ${id}: ${job.error}`);
    }
  }
}
