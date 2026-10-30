import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import {
  ApiDoc,
  MQTT_GROUPS,
  MQTT_PATTERNS,
  requiredString,
  sharePattern,
} from '@app/common';
import { clinicBody, requireClinic } from '../../clinic';
import { AuthService } from '../auth/auth.service';
import { VisitsService } from './visits.service';

@Controller()
export class VisitsController {
  constructor(
    private readonly visits: VisitsService,
    private readonly auth: AuthService,
  ) {}

  @MessagePattern(
    sharePattern(MQTT_GROUPS.MEDICAL, MQTT_PATTERNS.MEDICAL_VISIT_LIST),
  )
  @ApiDoc({ name: '复诊记录列表' })
  async list(payload: Record<string, unknown>) {
    await requireClinic(this.auth, payload);
    return this.visits.listForPatient(requiredString(payload.patientId, '患者标识'));
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.MEDICAL, MQTT_PATTERNS.MEDICAL_VISIT_SYNC),
  )
  @ApiDoc({ name: '同步复诊记录' })
  async sync(payload: Record<string, unknown>) {
    await requireClinic(this.auth, payload);
    return this.visits.sync(clinicBody(payload));
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.MEDICAL, MQTT_PATTERNS.MEDICAL_VISIT_REVIEW),
  )
  @ApiDoc({ name: '审核 AI 抽取结果' })
  async review(payload: Record<string, unknown>) {
    await requireClinic(this.auth, payload);
    const status = payload.status === 'rejected' ? 'rejected' : 'confirmed';
    return this.visits.review(
      requiredString(payload.externalId, '复诊标识'),
      status,
    );
  }
}
