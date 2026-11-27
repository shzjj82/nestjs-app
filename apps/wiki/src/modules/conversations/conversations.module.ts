import { Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';
import { AGENTS_CLIENT, mqttClientOptions } from '@app/common';
import { WikiConversationsController } from './conversations.controller';
import { WikiConversationsService } from './conversations.service';

@Module({
  imports: [
    ClientsModule.register([
      { name: AGENTS_CLIENT, ...mqttClientOptions('wiki-conversations') },
    ]),
  ],
  controllers: [WikiConversationsController],
  providers: [WikiConversationsService],
})
export class ConversationsModule {}
