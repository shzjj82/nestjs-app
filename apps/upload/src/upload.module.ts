import { Module } from '@nestjs/common';
import { RedisModule } from './common/redis.module';
import { SharedModule } from './common/shared.module';
import { JobsModule } from './jobs/jobs.module';
import { ObjectsModule } from './objects/objects.module';
import { StorageModule } from './storage/storage.module';
import { UploadController } from './upload.controller';

@Module({
  imports: [RedisModule, SharedModule, StorageModule, ObjectsModule, JobsModule],
  controllers: [UploadController],
})
export class UploadModule {}
