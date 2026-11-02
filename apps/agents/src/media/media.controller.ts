import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { AgentsHandleLogInterceptor, ApiDoc, MQTT_PATTERNS } from '@app/common';
import { agentsPattern } from '../common/rpc';
import { MediaJobsService } from './media-jobs.service';

@Controller()
@UseInterceptors(AgentsHandleLogInterceptor)
export class MediaController {
  constructor(private readonly jobs: MediaJobsService) {}

  @MessagePattern(agentsPattern(MQTT_PATTERNS.AGENTS_MEDIA_JOB))
  @ApiDoc({ name: '查询音视频任务', description: '听悟离线转写任务状态与结果' })
  getJob(payload: unknown) {
    return this.jobs.getJob(payload);
  }
}
