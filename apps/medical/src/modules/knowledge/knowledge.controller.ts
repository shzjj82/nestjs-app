import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import {
  ApiDoc,
  MQTT_GROUPS,
  MQTT_PATTERNS,
  optionalString,
  sharePattern,
} from '@app/common';
import { clinicBody, optionalNumber, requireClinic } from '../../clinic';
import { AuthService } from '../auth/auth.service';
import { KnowledgeService } from './knowledge.service';

@Controller()
export class KnowledgeController {
  constructor(
    private readonly knowledge: KnowledgeService,
    private readonly auth: AuthService,
  ) {}

  @MessagePattern(
    sharePattern(MQTT_GROUPS.MEDICAL, MQTT_PATTERNS.MEDICAL_KNOWLEDGE_EXTERNAL),
  )
  @ApiDoc({ name: '检索外部治疗参考' })
  async external(payload: Record<string, unknown>) {
    await requireClinic(this.auth, payload);
    return this.knowledge.searchExternal(
      optionalString(payload.q) ?? '',
      optionalNumber(payload.topK) ?? 5,
    );
  }

  @MessagePattern(
    sharePattern(
      MQTT_GROUPS.MEDICAL,
      MQTT_PATTERNS.MEDICAL_KNOWLEDGE_EXTERNAL_SYNC,
    ),
  )
  @ApiDoc({ name: '同步外部治疗参考' })
  async syncExternal(payload: Record<string, unknown>) {
    await requireClinic(this.auth, payload);
    return this.knowledge.syncExternal(clinicBody(payload));
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.MEDICAL, MQTT_PATTERNS.MEDICAL_KNOWLEDGE_INTERNAL),
  )
  @ApiDoc({ name: '检索内部治疗资料' })
  async internal(payload: Record<string, unknown>) {
    await requireClinic(this.auth, payload);
    return this.knowledge.searchInternal(
      optionalString(payload.q) ?? '',
      optionalNumber(payload.topK) ?? 5,
    );
  }

  @MessagePattern(
    sharePattern(
      MQTT_GROUPS.MEDICAL,
      MQTT_PATTERNS.MEDICAL_KNOWLEDGE_INTERNAL_SYNC,
    ),
  )
  @ApiDoc({ name: '同步内部治疗资料' })
  async syncInternal(payload: Record<string, unknown>) {
    await requireClinic(this.auth, payload);
    return this.knowledge.syncInternal(clinicBody(payload));
  }
}
