import { Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';
import { AGENTS_CLIENT, mqttClientOptions } from '@app/common';
import { TodosModule } from '../todos/todos.module';
import { WikiChatController } from './chat.controller';
import { WikiChatService } from './chat.service';

@Module({
  imports: [
    TodosModule,
    ClientsModule.register([{ name: AGENTS_CLIENT, ...mqttClientOptions('wiki-chat') }]),
  ],
  controllers: [WikiChatController],
  providers: [WikiChatService],
})
export class ChatModule {}
