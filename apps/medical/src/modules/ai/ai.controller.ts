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
import { AiService } from './ai.service';

@Controller()
export class AiController {
  constructor(
    private readonly ai: AiService,
    private readonly auth: AuthService,
  ) {}

  @MessagePattern(
    sharePattern(MQTT_GROUPS.MEDICAL, MQTT_PATTERNS.MEDICAL_AI_STATUS),
  )
  @ApiDoc({ name: 'AI 能力状态' })
  async status(payload: Record<string, unknown>) {
    await requireClinic(this.auth, payload);
    return this.ai.status();
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.MEDICAL, MQTT_PATTERNS.MEDICAL_AI_CHAT),
  )
  @ApiDoc({ name: '医生对话' })
  async chat(payload: Record<string, unknown>) {
    await requireClinic(this.auth, payload);
    return this.ai.chat(clinicBody(payload));
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.MEDICAL, MQTT_PATTERNS.MEDICAL_AI_ADVISE),
  )
  @ApiDoc({ name: '治疗建议' })
  async advise(payload: Record<string, unknown>) {
    await requireClinic(this.auth, payload);
    return this.ai.recommend({
      text: optionalString(payload.text),
      patientId: optionalString(payload.patientId),
      topK: optionalNumber(payload.topK),
    });
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.MEDICAL, MQTT_PATTERNS.MEDICAL_AI_PARSE),
  )
  @ApiDoc({ name: '解析口述医案' })
  async parse(payload: Record<string, unknown>) {
    await requireClinic(this.auth, payload);
    return this.ai.parseNote(clinicBody(payload));
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.MEDICAL, MQTT_PATTERNS.MEDICAL_AI_EXTRACT),
  )
  @ApiDoc({ name: '按页签摘录字段' })
  async extract(payload: Record<string, unknown>) {
    await requireClinic(this.auth, payload);
    return this.ai.extractSection(clinicBody(payload));
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.MEDICAL, MQTT_PATTERNS.MEDICAL_AI_COMPARE),
  )
  @ApiDoc({ name: '对照复诊变化' })
  async compare(payload: Record<string, unknown>) {
    await requireClinic(this.auth, payload);
    return this.ai.compareVisit(clinicBody(payload));
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.MEDICAL, MQTT_PATTERNS.MEDICAL_AI_SUMMARY),
  )
  @ApiDoc({ name: '生成病情摘要' })
  async summary(payload: Record<string, unknown>) {
    await requireClinic(this.auth, payload);
    return this.ai.summarizeVisit(clinicBody(payload));
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.MEDICAL, MQTT_PATTERNS.MEDICAL_AI_INTAKE_AUDIO),
  )
  @ApiDoc({ name: '接诊录音转写' })
  async intakeAudio(payload: Record<string, unknown>) {
    await requireClinic(this.auth, payload);
    return this.ai.transcribeIntake(clinicBody(payload));
  }
}
