import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { MediaJobsService } from './media-jobs.service';

@Injectable()
export class MediaPoller {
  private readonly logger = new Logger('MediaPoller');
  private running = false;

  constructor(private readonly jobs: MediaJobsService) {}

  @Interval(20_000)
  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const n = await this.jobs.pollDue();
      if (n > 0) this.logger.log(`听悟轮询 ${n} 条`);
    } catch (error) {
      this.logger.warn(`听悟轮询失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.running = false;
    }
  }
}
