import { Module } from '@nestjs/common';
import { ApiDocsModule, MQTT_GROUPS, MQTT_PATTERNS, sharePattern } from '@app/common';
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { ChatModule } from './chat/chat.module';
import { DatabaseModule } from './database/database.module';
import { SeedService } from './database/seed.service';
import { WikiController } from './wiki.controller';
import { DocumentsModule } from './documents/documents.module';
import { InboxModule } from './inbox/inbox.module';
import { OcrModule } from './ocr/ocr.module';
import { RagModule } from './rag/rag.module';
import { TeamsModule } from './teams/teams.module';
import { OpLogModule } from './oplog/op-log.module';
import { SharesModule } from './shares/shares.module';
import { TodosModule } from './todos/todos.module';
import { UploadModule } from './upload/upload.module';
import { VisionModule } from './vision/vision.module';

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
