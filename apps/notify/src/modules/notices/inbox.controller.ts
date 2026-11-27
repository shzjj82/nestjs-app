import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { ApiDoc, MQTT_PATTERNS, NotifyHandleLogInterceptor, sharePattern, MQTT_GROUPS } from '@app/common';
import { NoticesService } from './notices.service';

@Controller()
@UseInterceptors(NotifyHandleLogInterceptor)
export class InboxController {
  constructor(private readonly notices: NoticesService) {}

  @MessagePattern(sharePattern(MQTT_GROUPS.NOTIFY, MQTT_PATTERNS.NOTIFY_LIST))
  @ApiDoc({ name: '我的通知', description: '当前业务下本人的通知，可按 unread=1 只看未读' })
  list(payload: Record<string, unknown>) {
    return this.notices.list(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.NOTIFY, MQTT_PATTERNS.NOTIFY_UNREAD_COUNT))
  @ApiDoc({ name: '未读数量', description: '当前业务下本人未读通知数' })
  unreadCount(payload: Record<string, unknown>) {
    return this.notices.unreadCount(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.NOTIFY, MQTT_PATTERNS.NOTIFY_FIND_ONE))
  @ApiDoc({ name: '通知详情', description: '只能读取本人在当前业务下的通知' })
  findOne(payload: Record<string, unknown>) {
    return this.notices.findOne(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.NOTIFY, MQTT_PATTERNS.NOTIFY_READ))
  @ApiDoc({ name: '标记已读', description: '把本人的一条通知标为已读，并推送 socket' })
  markRead(payload: Record<string, unknown>) {
    return this.notices.markRead(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.NOTIFY, MQTT_PATTERNS.NOTIFY_READ_ALL))
  @ApiDoc({ name: '全部已读', description: '把当前业务下本人的未读通知全部标为已读，并推送 socket' })
  markAllRead(payload: Record<string, unknown>) {
    return this.notices.markAllRead(payload);
  }
}
