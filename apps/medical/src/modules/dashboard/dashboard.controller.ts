import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import {
  ApiDoc,
  MQTT_GROUPS,
  MQTT_PATTERNS,
  sharePattern,
} from '@app/common';
import { requireClinic } from '../../clinic';
import { AuthService } from '../auth/auth.service';
import { DashboardService } from './dashboard.service';

@Controller()
export class DashboardController {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly auth: AuthService,
  ) {}

  @MessagePattern(
    sharePattern(MQTT_GROUPS.MEDICAL, MQTT_PATTERNS.MEDICAL_DASHBOARD),
  )
  @ApiDoc({ name: '工作台摘要' })
  async summary(payload: Record<string, unknown>) {
    await requireClinic(this.auth, payload);
    return this.dashboard.summary();
  }
}
