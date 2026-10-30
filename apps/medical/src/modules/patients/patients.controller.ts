import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import {
  ApiDoc,
  MQTT_GROUPS,
  MQTT_PATTERNS,
  optionalString,
  requiredString,
  rpcFail,
  sharePattern,
} from '@app/common';
import { clinicBody, optionalNumber, requireClinic } from '../../clinic';
import { AuthService } from '../auth/auth.service';
import { CasesService } from '../cases/cases.service';
import { PatientsService } from './patients.service';
import { VisitsService } from './visits.service';

@Controller()
export class PatientsController {
  constructor(
    private readonly patients: PatientsService,
    private readonly visits: VisitsService,
    private readonly cases: CasesService,
    private readonly auth: AuthService,
  ) {}

  @MessagePattern(
    sharePattern(MQTT_GROUPS.MEDICAL, MQTT_PATTERNS.MEDICAL_PATIENT_LIST),
  )
  @ApiDoc({ name: '患者列表' })
  async list(payload: Record<string, unknown>) {
    await requireClinic(this.auth, payload);
    return this.patients.findAll({
      status: optionalString(payload.status),
      keyword: optionalString(payload.q) ?? optionalString(payload.keyword),
      disease: optionalString(payload.disease),
      syndrome: optionalString(payload.syndrome),
      course: optionalString(payload.course),
      tag: optionalString(payload.tag),
      doctor: optionalString(payload.doctor),
      visit: optionalString(payload.visit),
      view: optionalString(payload.view),
      page: optionalNumber(payload.page) ?? 1,
      pageSize: optionalNumber(payload.pageSize) ?? 10,
    });
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.MEDICAL, MQTT_PATTERNS.MEDICAL_PATIENT_FACETS),
  )
  @ApiDoc({ name: '患者筛选项' })
  async facets(payload: Record<string, unknown>) {
    await requireClinic(this.auth, payload);
    return this.patients.facets();
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.MEDICAL, MQTT_PATTERNS.MEDICAL_PATIENT_DUPLICATES),
  )
  @ApiDoc({ name: '疑似重复患者' })
  async duplicates(payload: Record<string, unknown>) {
    await requireClinic(this.auth, payload);
    return this.patients.duplicates();
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.MEDICAL, MQTT_PATTERNS.MEDICAL_PATIENT_MERGE),
  )
  @ApiDoc({ name: '合并重复患者' })
  async merge(payload: Record<string, unknown>) {
    await requireClinic(this.auth, payload);
    const primaryId = optionalString(payload.primaryId);
    const duplicateId = optionalString(payload.duplicateId);
    if (!primaryId || !duplicateId) rpcFail(400, '需要 primaryId 与 duplicateId');
    return this.patients.merge(primaryId, duplicateId);
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.MEDICAL, MQTT_PATTERNS.MEDICAL_PATIENT_UPDATE),
  )
  @ApiDoc({ name: '更新患者资料' })
  async update(payload: Record<string, unknown>) {
    await requireClinic(this.auth, payload);
    return this.patients.updateProfile(
      requiredString(payload.key, '患者标识'),
      clinicBody(payload, ['key']),
    );
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.MEDICAL, MQTT_PATTERNS.MEDICAL_PATIENT_DETAIL),
  )
  @ApiDoc({ name: '患者详情' })
  async detail(payload: Record<string, unknown>) {
    await requireClinic(this.auth, payload);
    const key = requiredString(payload.key, '患者标识');
    const patient = await this.patients.findOne(key);
    const [cases, visits] = await Promise.all([
      this.cases.listByPatient(key),
      this.visits.listForPatient(patient.externalId ?? patient.id),
    ]);
    return { ...(await this.patients.present(patient)), cases, visits };
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.MEDICAL, MQTT_PATTERNS.MEDICAL_PATIENT_SYNC),
  )
  @ApiDoc({ name: '同步患者' })
  async sync(payload: Record<string, unknown>) {
    await requireClinic(this.auth, payload);
    return this.patients.sync(clinicBody(payload));
  }
}
