import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { ApiDoc, MQTT_PATTERNS, WechatHandleLogInterceptor } from '@app/common';
import { wechatPattern } from '../common/rpc';
import { MiniProgramsService } from './miniprograms.service';

@Controller()
@UseInterceptors(WechatHandleLogInterceptor)
export class MiniProgramsController {
  constructor(private readonly programs: MiniProgramsService) {}

  @ApiDoc({ name: '小程序列表', description: '查看已登记的微信小程序' })
  @MessagePattern(wechatPattern(MQTT_PATTERNS.WECHAT_MP_FIND_ALL))
  findAll() {
    return this.programs.findAll();
  }

  @ApiDoc({ name: '登记小程序', description: '新建微信小程序配置' })
  @MessagePattern(wechatPattern(MQTT_PATTERNS.WECHAT_MP_CREATE))
  create(payload: Record<string, unknown>) {
    return this.programs.create(payload);
  }

  @ApiDoc({ name: '更新小程序', description: '编辑小程序与订阅模板' })
  @MessagePattern(wechatPattern(MQTT_PATTERNS.WECHAT_MP_UPDATE))
  update(payload: Record<string, unknown>) {
    return this.programs.update(payload);
  }

  @ApiDoc({ name: '删除小程序', description: '移除小程序登记' })
  @MessagePattern(wechatPattern(MQTT_PATTERNS.WECHAT_MP_DELETE))
  remove(payload: Record<string, unknown>) {
    return this.programs.remove(payload);
  }
}
