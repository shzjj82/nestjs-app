import { Module } from '@nestjs/common';
import { RagModule } from '../rag/rag.module';
import { ChatController } from './chat.controller';
import { ChatHttpController } from './chat-http.controller';
import { ChatService } from './chat.service';

@Module({
  imports: [RagModule],
  controllers: [ChatController, ChatHttpController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
