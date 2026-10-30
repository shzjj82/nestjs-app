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
import { normalizeDate } from '../../common/payload';
import { clinicBody, optionalNumber, requireClinic } from '../../clinic';
import { AuthService } from '../auth/auth.service';
import { SkillsService } from './skills.service';

@Controller()
export class SkillsController {
  constructor(
    private readonly skills: SkillsService,
    private readonly auth: AuthService,
  ) {}

  @MessagePattern(
    sharePattern(MQTT_GROUPS.MEDICAL, MQTT_PATTERNS.MEDICAL_SKILL_LIST),
  )
  @ApiDoc({ name: 'Skill 清单' })
  async list(payload: Record<string, unknown>) {
    await requireClinic(this.auth, payload);
    return this.skills.list();
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.MEDICAL, MQTT_PATTERNS.MEDICAL_SKILL_TRIGGERS),
  )
  @ApiDoc({ name: 'Skill 触发词' })
  async triggers(payload: Record<string, unknown>) {
    await requireClinic(this.auth, payload);
    return this.skills.listTriggers();
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.MEDICAL, MQTT_PATTERNS.MEDICAL_SKILL_RUN),
  )
  @ApiDoc({ name: '执行 Skill 工具' })
  async run(payload: Record<string, unknown>) {
    await requireClinic(this.auth, payload);
    const body = clinicBody(payload);
    return this.skills.run(
      requiredString(body.tool, '工具名'),
      (body.params as Record<string, unknown> | undefined) ?? {},
    );
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.MEDICAL, MQTT_PATTERNS.MEDICAL_SKILL_CHAT),
  )
  @ApiDoc({ name: 'Skill 自然语言入口' })
  async chat(payload: Record<string, unknown>) {
    await requireClinic(this.auth, payload);
    return this.skills.chat(optionalString(payload.message) ?? '');
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.MEDICAL, MQTT_PATTERNS.MEDICAL_SKILL_FOLLOWUP),
  )
  @ApiDoc({ name: '一次跟进录入' })
  async followup(payload: Record<string, unknown>) {
    await requireClinic(this.auth, payload);
    const body = clinicBody(payload);
    return this.skills.run('tcm_followup', {
      patient: requiredString(body.patient, '患者标识'),
      text: optionalString(body.text),
      'doctor-note': optionalString(body.doctorNote),
      audio: optionalString(body.audio),
      image: optionalString(body.image),
      severity: optionalNumber(body.severity),
      'visit-date': normalizeDate(optionalString(body.visitDate)),
      format: 'json',
    });
  }
}
