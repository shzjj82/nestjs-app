import { Module } from '@nestjs/common';
import { SharedModule } from '../common/shared.module';
import { StorageModule } from '../storage/storage.module';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { JobsStore } from './jobs.store';
import { JobsWorker } from './jobs.worker';

@Module({
  imports: [SharedModule, StorageModule],
  controllers: [JobsController],
  providers: [JobsStore, JobsService, JobsWorker],
  exports: [JobsService],
})
export class JobsModule {}
