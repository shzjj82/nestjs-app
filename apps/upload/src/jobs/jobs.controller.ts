import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { MQTT_PATTERNS } from '@app/common';
import { HandleLogInterceptor } from '../common/handle-log.interceptor';
import { uploadPattern } from '../common/rpc';
import { JobsService } from './jobs.service';

@Controller()
@UseInterceptors(HandleLogInterceptor)
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @MessagePattern(uploadPattern(MQTT_PATTERNS.UPLOAD_ENQUEUE))
  enqueue(payload: unknown) {
    return this.jobs.enqueue(payload);
  }

  @MessagePattern(uploadPattern(MQTT_PATTERNS.UPLOAD_JOB))
  findOne(payload: unknown) {
    return this.jobs.findOne(payload);
  }
}
