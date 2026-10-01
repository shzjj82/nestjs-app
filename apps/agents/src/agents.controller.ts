import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { AgentsHandleLogInterceptor, MQTT_PATTERNS, serviceHealth } from '@app/common';
import { aiConfigured, aiModel, aiVisionModel } from './chat/chat-env';
import { agentsPattern } from './common/rpc';

@Controller()
@UseInterceptors(AgentsHandleLogInterceptor)
export class AgentsController {
  @MessagePattern(agentsPattern(MQTT_PATTERNS.AGENTS_HEALTH))
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
