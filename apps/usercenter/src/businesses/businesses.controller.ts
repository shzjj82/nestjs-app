import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { MQTT_PATTERNS, UsercenterHandleLogInterceptor } from '@app/common';
import { ucPattern } from '../rpc';
import { BusinessesService } from './businesses.service';

@Controller()
@UseInterceptors(UsercenterHandleLogInterceptor)
export class BusinessesController {
  constructor(private readonly businesses: BusinessesService) {}

  @MessagePattern(ucPattern(MQTT_PATTERNS.BUSINESS_FIND_ALL))
  findAll() {
    return this.businesses.findAll();
  }

  @MessagePattern(ucPattern(MQTT_PATTERNS.BUSINESS_FIND_ONE))
  findOne(payload: Record<string, unknown>) {
    return this.businesses.findOne(payload);
  }

  @MessagePattern(ucPattern(MQTT_PATTERNS.BUSINESS_CREATE))
  create(payload: Record<string, unknown>) {
    return this.businesses.create(payload);
  }

  @MessagePattern(ucPattern(MQTT_PATTERNS.BUSINESS_UPDATE))
  update(payload: Record<string, unknown>) {
    return this.businesses.update(payload);
  }

  @MessagePattern(ucPattern(MQTT_PATTERNS.BUSINESS_SET_PERMISSIONS))
  setPermissions(payload: Record<string, unknown>) {
    return this.businesses.setPermissions(payload);
  }

  @MessagePattern(ucPattern(MQTT_PATTERNS.BUSINESS_MEMBER_FIND_ALL))
  listMembers(payload: Record<string, unknown>) {
    return this.businesses.listMembers(payload);
  }

  @MessagePattern(ucPattern(MQTT_PATTERNS.BUSINESS_MEMBER_UPDATE))
  updateMember(payload: Record<string, unknown>) {
    return this.businesses.updateMember(payload);
  }
}
