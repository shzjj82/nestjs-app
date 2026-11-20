import { Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';
import { NOTIFY_CLIENT, mqttClientOptions } from '@app/common';
import { WikiInboxController } from './inbox.controller';
import { WikiInboxService } from './inbox.service';

@Module({
  imports: [
    ClientsModule.register([{ name: NOTIFY_CLIENT, ...mqttClientOptions('wiki-inbox') }]),
  ],
  controllers: [WikiInboxController],
  providers: [WikiInboxService],
})
export class InboxModule {}