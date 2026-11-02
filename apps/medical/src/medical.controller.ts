import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import {
  AgentsClient,
  ApiDoc,
  MQTT_GROUPS,
  MQTT_PATTERNS,
  serviceHealth,
  sharePattern,
} from '@app/common';

@Controller()
export class MedicalController {
  constructor(private readonly agents: AgentsClient) {}

  @MessagePattern(
    sharePattern(MQTT_GROUPS.MEDICAL, MQTT_PATTERNS.MEDICAL_HEALTH),
  )
  @ApiDoc({ name: '中医服务健康检查' })
  async health() {
    let ai: Record<string, unknown> = { enabled: false };
    try {
      ai = await this.agents.status();
    } catch {
      ai = { enabled: false };
    }
    return serviceHealth('medical', {
      ai: { ...ai, via: 'agents', asr: 'agents', vision: 'agents' },
    });
  }
}
