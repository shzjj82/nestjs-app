import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { MQTT_PATTERNS } from '@app/common';
import { HandleLogInterceptor } from '../handle-log.interceptor';
import { ucPattern } from '../rpc';
import { AppsService } from './apps.service';

@Controller()
@UseInterceptors(HandleLogInterceptor)
export class AppsController {
  constructor(private readonly apps: AppsService) {}

  @MessagePattern(ucPattern(MQTT_PATTERNS.APP_FIND_ALL))
  findAll() {
    return this.apps.findAll();
  }

  @MessagePattern(ucPattern(MQTT_PATTERNS.APP_CREATE))
  create(payload: Record<string, unknown>) {
    return this.apps.create(payload);
  }

  @MessagePattern(ucPattern(MQTT_PATTERNS.APP_UPDATE))
  update(payload: Record<string, unknown>) {
    return this.apps.update(payload);
  }
}
