import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { MQTT_PATTERNS, WechatHandleLogInterceptor } from '@app/common';
import { wechatPattern } from '../common/rpc';
import { MiniProgramsService } from './miniprograms.service';

@Controller()
@UseInterceptors(WechatHandleLogInterceptor)
export class MiniProgramsController {
  constructor(private readonly programs: MiniProgramsService) {}

  @MessagePattern(wechatPattern(MQTT_PATTERNS.WECHAT_MP_FIND_ALL))
  findAll() {
    return this.programs.findAll();
  }

  @MessagePattern(wechatPattern(MQTT_PATTERNS.WECHAT_MP_CREATE))
  create(payload: Record<string, unknown>) {
    return this.programs.create(payload);
  }

  @MessagePattern(wechatPattern(MQTT_PATTERNS.WECHAT_MP_UPDATE))
  update(payload: Record<string, unknown>) {
    return this.programs.update(payload);
  }
}
