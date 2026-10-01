import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { ApiDoc, MQTT_PATTERNS } from '@app/common';
import { agentsPattern } from '../common/rpc';
import { VisionService } from './vision.service';

@Controller()
export class VisionController {
  constructor(private readonly vision: VisionService) {}

  @MessagePattern(agentsPattern(MQTT_PATTERNS.AGENTS_VISION_PARSE))
  @ApiDoc({ name: '视觉识别', description: '提示词由调用方传入，图片以 URL 传入' })
  parse(payload: unknown) {
    return this.vision.parse(payload);
  }
}
