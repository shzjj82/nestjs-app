import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { JobsStore } from './jobs.store';
import { JobsWorker } from './jobs.worker';

@Module({
  imports: [StorageModule],
  controllers: [JobsController],
  providers: [JobsStore, JobsService, JobsWorker],
  exports: [JobsService],
})
export class JobsModule {}
