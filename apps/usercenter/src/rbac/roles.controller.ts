import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { MQTT_PATTERNS } from '@app/common';
import { HandleLogInterceptor } from '../handle-log.interceptor';
import { ucPattern } from '../rpc';
import { RbacService } from './rbac.service';

@Controller()
@UseInterceptors(HandleLogInterceptor)
export class RolesController {
  constructor(private readonly rbac: RbacService) {}

  @MessagePattern(ucPattern(MQTT_PATTERNS.ROLE_FIND_ALL))
  findAll(payload: Record<string, unknown>) {
    return this.rbac.listRoles(payload);
  }

  @MessagePattern(ucPattern(MQTT_PATTERNS.ROLE_CREATE))
  create(payload: Record<string, unknown>) {
    return this.rbac.createRole(payload);
  }

  @MessagePattern(ucPattern(MQTT_PATTERNS.ROLE_UPDATE))
  update(payload: Record<string, unknown>) {
    return this.rbac.updateRole(payload);
  }

  @MessagePattern(ucPattern(MQTT_PATTERNS.ROLE_DELETE))
  remove(payload: Record<string, unknown>) {
    return this.rbac.deleteRole(payload);
  }

  @MessagePattern(ucPattern(MQTT_PATTERNS.ROLE_SET_PERMISSIONS))
  setPermissions(payload: Record<string, unknown>) {
    return this.rbac.setRolePermissions(payload);
  }
}
