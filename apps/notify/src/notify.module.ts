import { Module } from '@nestjs/common';
import {
  ApiDocsModule,
  MQTT_GROUPS,
  MQTT_PATTERNS,
  sharePattern,
} from '@app/common';
import { DatabaseModule } from './database/database.module';
import { NoticesModule } from './modules/notices/notices.module';
import { NotifyController } from './notify.controller';
import { TodosModule } from './modules/todos/todos.module';

@Module({
  imports: [
    DatabaseModule,
    NoticesModule,
    TodosModule,
    ApiDocsModule.forService({
      service: 'notify',
      label: '消息通知',
      pattern: sharePattern(MQTT_GROUPS.NOTIFY, MQTT_PATTERNS.NOTIFY_API_DOCS),
    }),
  ],
  controllers: [NotifyController],
})
export class NotifyModule {}
