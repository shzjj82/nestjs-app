import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConversationEntity } from '../entities/conversation.entity';
import { ConversationMessageEntity } from '../entities/conversation-message.entity';
import { RagModule } from '../rag/rag.module';
import { ChatController } from './chat.controller';
import { ChatHttpController } from './chat-http.controller';
import { ChatService } from './chat.service';
import { ConversationController } from './conversation.controller';
import { ConversationService } from './conversation.service';

@Module({
  imports: [
    RagModule,
    TypeOrmModule.forFeature([ConversationEntity, ConversationMessageEntity]),
  ],
  controllers: [ChatController, ChatHttpController, ConversationController],
  providers: [ChatService, ConversationService],
  exports: [ChatService, ConversationService],
})
export class ChatModule {}
