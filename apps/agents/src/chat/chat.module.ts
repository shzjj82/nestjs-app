import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatHttpController } from './chat-http.controller';
import { ChatService } from './chat.service';

@Module({
  controllers: [ChatController, ChatHttpController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
