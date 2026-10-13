import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { ApiDoc, MQTT_PATTERNS, UsercenterHandleLogInterceptor } from '@app/common';
import { ucPattern } from '../rpc';
import { RbacService } from './rbac.service';

@Controller()
@UseInterceptors(UsercenterHandleLogInterceptor)
export class RolesController {
  constructor(private readonly rbac: RbacService) {}

  @ApiDoc({ name: '角色列表', description: '查看平台级与业务身份角色' })
  @MessagePattern(ucPattern(MQTT_PATTERNS.ROLE_FIND_ALL))
  findAll(payload: Record<string, unknown>) {
    return this.rbac.listRoles(payload);
  }

  @ApiDoc({ name: '创建角色', description: '新建业务身份角色' })
  @MessagePattern(ucPattern(MQTT_PATTERNS.ROLE_CREATE))
  create(payload: Record<string, unknown>) {
    return this.rbac.createRole(payload);
  }

  @ApiDoc({ name: '更新角色', description: '编辑角色名称与描述' })
  @MessagePattern(ucPattern(MQTT_PATTERNS.ROLE_UPDATE))
  update(payload: Record<string, unknown>) {
    return this.rbac.updateRole(payload);
  }

  @ApiDoc({ name: '删除角色', description: '删除业务身份角色' })
  @MessagePattern(ucPattern(MQTT_PATTERNS.ROLE_DELETE))
  remove(payload: Record<string, unknown>) {
    return this.rbac.deleteRole(payload);
  }

  @ApiDoc({ name: '配置角色功能点', description: '给平台级角色勾选功能点' })
  @MessagePattern(ucPattern(MQTT_PATTERNS.ROLE_SET_PERMISSIONS))
  setPermissions(payload: Record<string, unknown>) {
    return this.rbac.setRolePermissions(payload);
  }
}
