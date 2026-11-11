import { Module } from '@nestjs/common';
import { ApiDocsModule, MQTT_GROUPS, MQTT_PATTERNS, sharePattern } from '@app/common';
import { CategoriesModule } from './categories/categories.module';
import { DatabaseModule } from './database/database.module';
import { SeedService } from './database/seed.service';
import { WikiController } from './wiki.controller';
import { DocumentsModule } from './documents/documents.module';
import { TeamsModule } from './teams/teams.module';

@Module({
  imports: [
    DatabaseModule,
    CategoriesModule,
    DocumentsModule,
    TeamsModule,
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
