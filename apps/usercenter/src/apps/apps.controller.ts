import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { ApiDoc, MQTT_PATTERNS, UsercenterHandleLogInterceptor } from '@app/common';
import { ucPattern } from '../rpc';
import { ClientsService } from './clients.service';

@Controller()
@UseInterceptors(UsercenterHandleLogInterceptor)
export class AppsController {
  constructor(private readonly clients: ClientsService) {}

  @ApiDoc({ name: '接入端列表', description: '查看 Web / 小程序接入端' })
  @MessagePattern(ucPattern(MQTT_PATTERNS.CLIENT_FIND_ALL))
  findAll(payload: Record<string, unknown>) {
    return this.clients.findAll(payload);
  }

  @ApiDoc({ name: '创建接入端', description: '登记接入端' })
  @MessagePattern(ucPattern(MQTT_PATTERNS.CLIENT_CREATE))
  create(payload: Record<string, unknown>) {
    return this.clients.create(payload);
  }

  @ApiDoc({ name: '更新接入端', description: '编辑接入端配置' })
  @MessagePattern(ucPattern(MQTT_PATTERNS.CLIENT_UPDATE))
  update(payload: Record<string, unknown>) {
    return this.clients.update(payload);
  }
}
