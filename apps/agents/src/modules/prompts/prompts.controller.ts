import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import {
  AgentsHandleLogInterceptor,
  ApiDoc,
  MQTT_GROUPS,
  MQTT_PATTERNS,
  sharePattern,
} from '@app/common';
import { PromptsService } from './prompts.service';

@Controller()
@UseInterceptors(AgentsHandleLogInterceptor)
export class PromptsController {
  constructor(private readonly prompts: PromptsService) {}

  @MessagePattern(sharePattern(MQTT_GROUPS.AGENTS, MQTT_PATTERNS.AGENTS_PROMPT_FIND))
  @ApiDoc({ name: '读取提示词', description: '按 code 读取。优先 Redis，没有则从数据库装入 Redis' })
  find(payload: unknown) {
    return this.prompts.find(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.AGENTS, MQTT_PATTERNS.AGENTS_PROMPT_UPDATE))
  @ApiDoc({ name: '更新提示词', description: '按 code 改正文，并删掉 Redis 里的旧缓存' })
  update(payload: unknown) {
    return this.prompts.update(payload);
  }
}
