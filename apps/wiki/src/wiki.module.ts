import { Module } from '@nestjs/common';
import { ApiDocsModule, MQTT_GROUPS, MQTT_PATTERNS, sharePattern } from '@app/common';
import { AuthModule } from './modules/auth/auth.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { ChatModule } from './modules/chat/chat.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { DatabaseModule } from './database/database.module';
import { SeedService } from './database/seed.service';
import { WikiController } from './wiki.controller';
import { DocumentsModule } from './modules/documents/documents.module';
import { InboxModule } from './modules/inbox/inbox.module';
import { OcrModule } from './modules/ocr/ocr.module';
import { RagModule } from './modules/rag/rag.module';
import { TeamsModule } from './modules/teams/teams.module';
import { OpLogModule } from './modules/oplog/op-log.module';
import { SharesModule } from './modules/shares/shares.module';
import { TodosModule } from './modules/todos/todos.module';
import { UploadModule } from './modules/upload/upload.module';
import { VisionModule } from './modules/vision/vision.module';

@Module({
  imports: [
    DatabaseModule,
    CategoriesModule,
    DocumentsModule,
    TeamsModule,
    TodosModule,
    SharesModule,
    OpLogModule,
    AuthModule,
    UploadModule,
    ChatModule,
    ConversationsModule,
    RagModule,
    VisionModule,
    OcrModule,
    InboxModule,
    ApiDocsModule.forService({
      service: 'wiki',
      label: 'Wiki 模块',
      pattern: sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_API_DOCS),
    }),
  ],
  controllers: [WikiController],
  providers: [SeedService],
})
export class WikiModule {}
