import { Module } from '@nestjs/common';
import { ConversationsModule } from '../conversations/conversations.module';
import { PromptsModule } from '../prompts/prompts.module';
import { RagModule } from '../rag/rag.module';
import { ChatController } from './chat.controller';
import { ChatHttpController } from './chat-http.controller';
import { ChatService } from './chat.service';
import { ChatToolChooser } from './tool-choice';

@Module({
  imports: [RagModule, ConversationsModule, PromptsModule],
  controllers: [ChatController, ChatHttpController],
  providers: [ChatService, ChatToolChooser],
  exports: [ChatService],
})
export class ChatModule {}
