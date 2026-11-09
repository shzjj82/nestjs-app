import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { ApiDoc, MQTT_PATTERNS, NotifyHandleLogInterceptor, sharePattern, MQTT_GROUPS } from '@app/common';
import { parseSend, requireActor, requireInternal } from '../common/input';
import { NoticesService } from './notices.service';

@Controller()
@UseInterceptors(NotifyHandleLogInterceptor)
export class SendController {
  constructor(private readonly notices: NoticesService) {}

  @MessagePattern(sharePattern(MQTT_GROUPS.NOTIFY, MQTT_PATTERNS.NOTIFY_ADMIN_SEND))
  @ApiDoc({
    name: '发送通知',
    description: '向指定业务下的用户投递一条通知，并经 socket 推送',
  })
  adminSend(payload: Record<string, unknown>) {
    requireActor(payload);
    return this.notices.send(parseSend(payload, 'admin'));
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.NOTIFY, MQTT_PATTERNS.NOTIFY_SEND))
  send(payload: Record<string, unknown>) {
    requireInternal(payload);
    return this.notices.send(parseSend(payload, 'service'));
  }
}
