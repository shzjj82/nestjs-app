import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from '../database/database.module';
import { MediaController } from './media.controller';
import { MediaJobsService } from './media-jobs.service';
import { MediaPoller } from './media.poller';
import { TingwuClient } from './tingwu.client';

@Module({
  imports: [ScheduleModule.forRoot(), DatabaseModule],
  controllers: [MediaController],
  providers: [TingwuClient, MediaJobsService, MediaPoller],
  exports: [MediaJobsService, TingwuClient],
})
export class MediaModule {}
