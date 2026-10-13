import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { ApiDoc, MQTT_PATTERNS, UsercenterHandleLogInterceptor } from '@app/common';
import { ucPattern } from '../rpc';
import { ExcelService } from './excel.service';
import { RbacService } from './rbac.service';

@Controller()
@UseInterceptors(UsercenterHandleLogInterceptor)
export class PermissionsController {
  constructor(
    private readonly rbac: RbacService,
    private readonly excel: ExcelService,
  ) {}

  @ApiDoc({ name: '功能点列表', description: '查看全局功能点目录' })
  @MessagePattern(ucPattern(MQTT_PATTERNS.PERMISSION_FIND_ALL))
  findAll(payload: Record<string, unknown>) {
    return this.rbac.listPermissions(payload);
  }

  @ApiDoc({ name: '创建功能点', description: '新建功能点' })
  @MessagePattern(ucPattern(MQTT_PATTERNS.PERMISSION_CREATE))
  create(payload: Record<string, unknown>) {
    return this.rbac.createPermission(payload);
  }

  @ApiDoc({ name: '更新功能点', description: '编辑功能点' })
  @MessagePattern(ucPattern(MQTT_PATTERNS.PERMISSION_UPDATE))
  update(payload: Record<string, unknown>) {
    return this.rbac.updatePermission(payload);
  }

  @ApiDoc({ name: '删除功能点', description: '删除功能点' })
  @MessagePattern(ucPattern(MQTT_PATTERNS.PERMISSION_DELETE))
  remove(payload: Record<string, unknown>) {
    return this.rbac.deletePermission(payload);
  }

  @ApiDoc({ name: '导出功能点', description: '导出 Excel' })
  @MessagePattern(ucPattern(MQTT_PATTERNS.PERMISSION_EXPORT))
  exportWorkbook(payload: Record<string, unknown>) {
    return this.excel.exportWorkbook(payload);
  }

  @ApiDoc({ name: '功能点模版', description: '下载 Excel 模版' })
  @MessagePattern(ucPattern(MQTT_PATTERNS.PERMISSION_TEMPLATE))
  templateWorkbook(payload: Record<string, unknown>) {
    return this.excel.templateWorkbook(payload);
  }

  @ApiDoc({ name: '导入功能点', description: '从 Excel 导入' })
  @MessagePattern(ucPattern(MQTT_PATTERNS.PERMISSION_IMPORT))
  importWorkbook(payload: Record<string, unknown>) {
    return this.excel.importWorkbook(payload);
  }
}
