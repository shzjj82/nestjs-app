import { Module } from '@nestjs/common';
import { ApiDocsModule, MQTT_GROUPS, MQTT_PATTERNS, RedisInfraModule, sharePattern } from '@app/common';
import { JobsModule } from './jobs/jobs.module';
import { ObjectsModule } from './objects/objects.module';
import { StorageModule } from './storage/storage.module';
import { UploadController } from './upload.controller';

@Module({
  imports: [
    RedisInfraModule,
    StorageModule,
    ObjectsModule,
    JobsModule,
    ApiDocsModule.forService({
      service: 'upload',
      label: '上传模块',
      pattern: sharePattern(MQTT_GROUPS.UPLOAD, MQTT_PATTERNS.UPLOAD_API_DOCS),
    }),
  ],
  controllers: [UploadController],
})
export class UploadModule {}
