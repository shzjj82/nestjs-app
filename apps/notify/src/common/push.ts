import { Logger } from '@nestjs/common';
import { notifyTopic, publishMqttJson } from '@app/common';
import type { NotifyRealtimeEvent } from '@app/notify-contract';

export async function pushRealtime(event: NotifyRealtimeEvent): Promise<void> {
  const item = event.item;
  try {
    await publishMqttJson(notifyTopic(item.bizCode, item.userId), event);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'publish failed';
    const id = 'id' in item ? item.id : item.userId;
    new Logger('NotifyPush').warn(`实时推送失败 ${id}: ${message}`);
  }
}
