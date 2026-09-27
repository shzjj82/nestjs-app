import { Module } from '@nestjs/common';
import { RedisInfraModule } from '@app/common';
import { JobsModule } from './jobs/jobs.module';
import { ObjectsModule } from './objects/objects.module';
import { StorageModule } from './storage/storage.module';
import { UploadController } from './upload.controller';

@Module({
  imports: [RedisInfraModule, StorageModule, ObjectsModule, JobsModule],
  controllers: [UploadController],
})
export class UploadModule {}
