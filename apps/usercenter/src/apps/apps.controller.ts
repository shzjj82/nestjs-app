import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { MQTT_PATTERNS } from '@app/common';
import { HandleLogInterceptor } from '../handle-log.interceptor';
import { ucPattern } from '../rpc';
import { ClientsService } from './clients.service';

@Controller()
@UseInterceptors(HandleLogInterceptor)
export class AppsController {
  constructor(private readonly clients: ClientsService) {}

  @MessagePattern(ucPattern(MQTT_PATTERNS.CLIENT_FIND_ALL))
  findAll() {
    return this.clients.findAll();
  }

  @MessagePattern(ucPattern(MQTT_PATTERNS.CLIENT_CREATE))
  create(payload: Record<string, unknown>) {
    return this.clients.create(payload);
  }

  @MessagePattern(ucPattern(MQTT_PATTERNS.CLIENT_UPDATE))
  update(payload: Record<string, unknown>) {
    return this.clients.update(payload);
  }
}
