import { Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';
import { AGENTS_CLIENT, mqttClientOptions } from '@app/common';
import { WikiChatController } from './chat.controller';
import { WikiChatService } from './chat.service';

@Module({
  imports: [
    ClientsModule.register([{ name: AGENTS_CLIENT, ...mqttClientOptions('wiki-chat') }]),
  ],
  controllers: [WikiChatController],
  providers: [WikiChatService],
})
export class ChatModule {}
