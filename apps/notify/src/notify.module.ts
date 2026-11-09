import { Module } from '@nestjs/common';
import {
  ApiDocsModule,
  MQTT_GROUPS,
  MQTT_PATTERNS,
  sharePattern,
} from '@app/common';
import { DatabaseModule } from './database/database.module';
import { InboxController } from './notices/inbox.controller';
import { NoticesService } from './notices/notices.service';
import { SendController } from './notices/send.controller';
import { NotifyController } from './notify.controller';
import { TodosController } from './todos/todos.controller';
import { TodosService } from './todos/todos.service';

@Module({
  imports: [
    DatabaseModule,
    ApiDocsModule.forService({
      service: 'notify',
      label: '消息通知',
      pattern: sharePattern(MQTT_GROUPS.NOTIFY, MQTT_PATTERNS.NOTIFY_API_DOCS),
    }),
  ],
  controllers: [NotifyController, InboxController, SendController, TodosController],
  providers: [NoticesService, TodosService],
})
export class NotifyModule {}
