import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { MQTT_PATTERNS } from '@app/common';
import { HandleLogInterceptor } from '../handle-log.interceptor';
import { requiredString, ucPattern } from '../rpc';
import { UsersService } from './users.service';

@Controller()
@UseInterceptors(HandleLogInterceptor)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @MessagePattern(ucPattern(MQTT_PATTERNS.USER_FIND_ALL))
  findAll(payload: Record<string, unknown>) {
    return this.users.findAll(payload ?? {});
  }

  @MessagePattern(ucPattern(MQTT_PATTERNS.USER_FIND_ONE))
  findOne(payload: { id?: string }) {
    return this.users.findOne(requiredString(payload?.id, 'id'));
  }

  @MessagePattern(ucPattern(MQTT_PATTERNS.USER_CREATE))
  create(payload: Record<string, unknown>) {
    return this.users.createByAdmin(payload);
  }

  @MessagePattern(ucPattern(MQTT_PATTERNS.USER_UPDATE))
  update(payload: Record<string, unknown>) {
    return this.users.update(payload);
  }

  @MessagePattern(ucPattern(MQTT_PATTERNS.USER_BIND_APP))
  bindApp(payload: Record<string, unknown>) {
    return this.users.bindAppByPayload(payload);
  }

  @MessagePattern(ucPattern(MQTT_PATTERNS.USER_ASSIGN_ROLES))
  assignRoles(payload: Record<string, unknown>) {
    return this.users.assignRolesByPayload(payload);
  }
}
