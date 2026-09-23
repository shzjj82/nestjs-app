import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { MQTT_PATTERNS } from '@app/common';
import { HandleLogInterceptor } from '../handle-log.interceptor';
import { ucPattern } from '../rpc';
import { ExcelService } from './excel.service';
import { RbacService } from './rbac.service';

@Controller()
@UseInterceptors(HandleLogInterceptor)
export class PermissionsController {
  constructor(
    private readonly rbac: RbacService,
    private readonly excel: ExcelService,
  ) {}

  @MessagePattern(ucPattern(MQTT_PATTERNS.PERMISSION_FIND_ALL))
  findAll(payload: Record<string, unknown>) {
    return this.rbac.listPermissions(payload);
  }

  @MessagePattern(ucPattern(MQTT_PATTERNS.PERMISSION_CREATE))
  create(payload: Record<string, unknown>) {
    return this.rbac.createPermission(payload);
  }

  @MessagePattern(ucPattern(MQTT_PATTERNS.PERMISSION_UPDATE))
  update(payload: Record<string, unknown>) {
    return this.rbac.updatePermission(payload);
  }

  @MessagePattern(ucPattern(MQTT_PATTERNS.PERMISSION_DELETE))
  remove(payload: Record<string, unknown>) {
    return this.rbac.deletePermission(payload);
  }

  @MessagePattern(ucPattern(MQTT_PATTERNS.PERMISSION_EXPORT))
  exportWorkbook(payload: Record<string, unknown>) {
    return this.excel.exportWorkbook(payload);
  }

  @MessagePattern(ucPattern(MQTT_PATTERNS.PERMISSION_IMPORT))
  importWorkbook(payload: Record<string, unknown>) {
    return this.excel.importWorkbook(payload);
  }
}
