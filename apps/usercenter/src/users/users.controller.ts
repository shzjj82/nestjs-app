import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { ApiDoc, MQTT_PATTERNS, UsercenterHandleLogInterceptor } from '@app/common';
import { requiredString, ucPattern } from '../rpc';
import { UsersService } from './users.service';

@Controller()
@UseInterceptors(UsercenterHandleLogInterceptor)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @ApiDoc({ name: '用户列表', description: '分页查询用户' })
  @MessagePattern(ucPattern(MQTT_PATTERNS.USER_FIND_ALL))
  findAll(payload: Record<string, unknown>) {
    return this.users.findAll(payload ?? {});
  }

  @ApiDoc({ name: '用户详情', description: '按 ID 查看用户' })
  @MessagePattern(ucPattern(MQTT_PATTERNS.USER_FIND_ONE))
  findOne(payload: { id?: string }) {
    return this.users.findOne(requiredString(payload?.id, 'id'));
  }

  @ApiDoc({ name: '创建用户', description: '后台创建用户账号' })
  @MessagePattern(ucPattern(MQTT_PATTERNS.USER_CREATE))
  create(payload: Record<string, unknown>) {
    return this.users.createByAdmin(payload);
  }

  @ApiDoc({ name: '更新用户', description: '编辑用户资料' })
  @MessagePattern(ucPattern(MQTT_PATTERNS.USER_UPDATE))
  update(payload: Record<string, unknown>) {
    return this.users.update(payload);
  }

  @ApiDoc({ name: '更新账户', description: '启停账户等' })
  @MessagePattern(ucPattern(MQTT_PATTERNS.ACCOUNT_UPDATE))
  updateAccount(payload: Record<string, unknown>) {
    return this.users.updateAccount(payload);
  }

  @ApiDoc({ name: '分配账户角色', description: '给账户勾选角色组' })
  @MessagePattern(ucPattern(MQTT_PATTERNS.ACCOUNT_ASSIGN_ROLES))
  assignAccountRoles(payload: Record<string, unknown>) {
    return this.users.assignAccountRoles(payload);
  }

  @MessagePattern(ucPattern(MQTT_PATTERNS.ACCOUNT_FIND_MANY))
  findAccounts(payload: Record<string, unknown>) {
    return this.users.findAccounts(payload ?? {});
  }

  @MessagePattern(ucPattern(MQTT_PATTERNS.ACCOUNT_ENSURE_ROLES))
  ensureAccountRoles(payload: Record<string, unknown>) {
    return this.users.ensureAccountRoles(payload ?? {});
  }
}
