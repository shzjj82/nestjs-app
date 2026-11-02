import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { AgentsHandleLogInterceptor, ApiDoc, MQTT_PATTERNS } from '@app/common';
import { agentsPattern } from '../common/rpc';
import { VideoService } from './video.service';

@Controller()
@UseInterceptors(AgentsHandleLogInterceptor)
export class VideoController {
  constructor(private readonly video: VideoService) {}

  @MessagePattern(agentsPattern(MQTT_PATTERNS.AGENTS_VIDEO_SUBMIT))
  @ApiDoc({ name: '提交视频转写', description: '通义听悟离线任务，立即返回 jobId' })
  submit(payload: unknown) {
    return this.video.submit(payload);
  }
}
