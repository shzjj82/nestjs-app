import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { AgentsHandleLogInterceptor, MQTT_PATTERNS, serviceHealth, sharePattern, MQTT_GROUPS } from '@app/common';
import { aiConfigured, aiModel, aiVisionModel } from './chat/chat-env';

@Controller()
@UseInterceptors(AgentsHandleLogInterceptor)
export class AgentsController {
  @MessagePattern(sharePattern(MQTT_GROUPS.AGENTS, MQTT_PATTERNS.AGENTS_HEALTH))
  health() {
    return serviceHealth('agents', {
      chat: {
        enabled: aiConfigured(),
        model: aiModel(),
      },
      vision: {
        enabled: aiConfigured(),
        model: aiVisionModel(),
      },
    });
  }
}
