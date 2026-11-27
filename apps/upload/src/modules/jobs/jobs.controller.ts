import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { ApiDoc, MQTT_PATTERNS, UploadHandleLogInterceptor, sharePattern, MQTT_GROUPS } from '@app/common';
import { JobsService } from './jobs.service';

@Controller()
@UseInterceptors(UploadHandleLogInterceptor)
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @MessagePattern(sharePattern(MQTT_GROUPS.UPLOAD, MQTT_PATTERNS.UPLOAD_ENQUEUE))
  @ApiDoc({ name: '异步上传', description: '入队后台上传，返回任务 id' })
  enqueue(payload: unknown) {
    return this.jobs.enqueue(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.UPLOAD, MQTT_PATTERNS.UPLOAD_JOB))
  @ApiDoc({ name: '查询上传任务' })
  findOne(payload: unknown) {
    return this.jobs.findOne(payload);
  }
}
