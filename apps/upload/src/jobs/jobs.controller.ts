import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { ApiDoc, MQTT_PATTERNS, UploadHandleLogInterceptor } from '@app/common';
import { uploadPattern } from '../common/rpc';
import { JobsService } from './jobs.service';

@Controller()
@UseInterceptors(UploadHandleLogInterceptor)
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @MessagePattern(uploadPattern(MQTT_PATTERNS.UPLOAD_ENQUEUE))
  @ApiDoc({ name: '异步上传', description: '入队后台上传，返回任务 id' })
  enqueue(payload: unknown) {
    return this.jobs.enqueue(payload);
  }

  @MessagePattern(uploadPattern(MQTT_PATTERNS.UPLOAD_JOB))
  @ApiDoc({ name: '查询上传任务' })
  findOne(payload: unknown) {
    return this.jobs.findOne(payload);
  }
}
