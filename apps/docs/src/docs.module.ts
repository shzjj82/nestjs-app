import { Module } from '@nestjs/common';
import { ApiDocsModule, MQTT_GROUPS, MQTT_PATTERNS, sharePattern } from '@app/common';
import { CategoriesModule } from './categories/categories.module';
import { DatabaseModule } from './database/database.module';
import { SeedService } from './database/seed.service';
import { DocsController } from './docs.controller';
import { DocumentsModule } from './documents/documents.module';

@Module({
  imports: [
    DatabaseModule,
    CategoriesModule,
    DocumentsModule,
    ApiDocsModule.forService({
      service: 'docs',
      label: '文档模块',
      pattern: sharePattern(MQTT_GROUPS.DOCS, MQTT_PATTERNS.DOC_API_DOCS),
    }),
  ],
  controllers: [DocsController],
  providers: [SeedService],
})
export class DocsModule {}
