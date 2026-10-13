import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { ApiDoc, MQTT_PATTERNS, UsercenterHandleLogInterceptor } from '@app/common';
import { ucPattern } from '../rpc';
import { BusinessesService } from './businesses.service';

@Controller()
@UseInterceptors(UsercenterHandleLogInterceptor)
export class BusinessesController {
  constructor(private readonly businesses: BusinessesService) {}

  @ApiDoc({ name: '业务列表', description: '查看全部业务租户' })
  @MessagePattern(ucPattern(MQTT_PATTERNS.BUSINESS_FIND_ALL))
  findAll() {
    return this.businesses.findAll();
  }

  @ApiDoc({ name: '业务详情', description: '查看单个业务' })
  @MessagePattern(ucPattern(MQTT_PATTERNS.BUSINESS_FIND_ONE))
  findOne(payload: Record<string, unknown>) {
    return this.businesses.findOne(payload);
  }

  @ApiDoc({ name: '创建业务', description: '新建业务租户' })
  @MessagePattern(ucPattern(MQTT_PATTERNS.BUSINESS_CREATE))
  create(payload: Record<string, unknown>) {
    return this.businesses.create(payload);
  }

  @ApiDoc({ name: '更新业务', description: '编辑业务信息与开通接口' })
  @MessagePattern(ucPattern(MQTT_PATTERNS.BUSINESS_UPDATE))
  update(payload: Record<string, unknown>) {
    return this.businesses.update(payload);
  }

  @ApiDoc({ name: '设置业务权限', description: '遗留：设置业务功能点' })
  @MessagePattern(ucPattern(MQTT_PATTERNS.BUSINESS_SET_PERMISSIONS))
  setPermissions(payload: Record<string, unknown>) {
    return this.businesses.setPermissions(payload);
  }

  @ApiDoc({ name: '业务成员列表', description: '查看业务下成员' })
  @MessagePattern(ucPattern(MQTT_PATTERNS.BUSINESS_MEMBER_FIND_ALL))
  listMembers(payload: Record<string, unknown>) {
    return this.businesses.listMembers(payload);
  }

  @ApiDoc({ name: '更新业务成员', description: '调整成员状态或角色' })
  @MessagePattern(ucPattern(MQTT_PATTERNS.BUSINESS_MEMBER_UPDATE))
  updateMember(payload: Record<string, unknown>) {
    return this.businesses.updateMember(payload);
  }
}
