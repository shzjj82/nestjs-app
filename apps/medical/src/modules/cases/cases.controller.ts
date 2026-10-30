import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import {
  ApiDoc,
  MQTT_GROUPS,
  MQTT_PATTERNS,
  optionalString,
  requiredString,
  sharePattern,
} from '@app/common';
import { clinicBody, requireClinic } from '../../clinic';
import { AuthService } from '../auth/auth.service';
import { CasesService } from './cases.service';

@Controller()
export class CasesController {
  constructor(
    private readonly cases: CasesService,
    private readonly auth: AuthService,
  ) {}

  @MessagePattern(
    sharePattern(MQTT_GROUPS.MEDICAL, MQTT_PATTERNS.MEDICAL_CASE_LIST),
  )
  @ApiDoc({ name: '医案列表' })
  async list(payload: Record<string, unknown>) {
    await requireClinic(this.auth, payload);
    if (optionalString(payload.status) === 'archived') {
      return this.cases.listArchived();
    }
    const patientId = optionalString(payload.patientId);
    if (!patientId) return [];
    return this.cases.listByPatient(patientId);
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.MEDICAL, MQTT_PATTERNS.MEDICAL_CASE_DETAIL),
  )
  @ApiDoc({ name: '医案详情' })
  async detail(payload: Record<string, unknown>) {
    await requireClinic(this.auth, payload);
    const key = requiredString(payload.key, '医案标识');
    const record = await this.cases.findOne(key);
    const visits = await this.cases.listVisits(key);
    return { ...record, visits };
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.MEDICAL, MQTT_PATTERNS.MEDICAL_CASE_CREATE),
  )
  @ApiDoc({ name: '新建医案' })
  async create(payload: Record<string, unknown>) {
    await requireClinic(this.auth, payload);
    return this.cases.create(clinicBody(payload));
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.MEDICAL, MQTT_PATTERNS.MEDICAL_CASE_UPDATE),
  )
  @ApiDoc({ name: '更新医案' })
  async update(payload: Record<string, unknown>) {
    await requireClinic(this.auth, payload);
    return this.cases.update(
      requiredString(payload.key, '医案标识'),
      clinicBody(payload, ['key']),
    );
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.MEDICAL, MQTT_PATTERNS.MEDICAL_CASE_ADD_VISIT),
  )
  @ApiDoc({ name: '追加治疗记录' })
  async addVisit(payload: Record<string, unknown>) {
    await requireClinic(this.auth, payload);
    return this.cases.addVisit(
      requiredString(payload.key, '医案标识'),
      clinicBody(payload, ['key']),
    );
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.MEDICAL, MQTT_PATTERNS.MEDICAL_CASE_ARCHIVE),
  )
  @ApiDoc({ name: '归档医案' })
  async archive(payload: Record<string, unknown>) {
    await requireClinic(this.auth, payload);
    return this.cases.archive(requiredString(payload.key, '医案标识'));
  }
}
