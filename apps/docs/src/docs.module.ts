import { Module } from '@nestjs/common';
import { CategoriesModule } from './categories/categories.module';
import { SharedModule } from './common/shared.module';
import { DatabaseModule } from './database/database.module';
import { SeedService } from './database/seed.service';
import { DocsController } from './docs.controller';
import { DocumentsModule } from './documents/documents.module';
import { SiteModule } from './site/site.module';

@Module({
  imports: [
    DatabaseModule,
    SharedModule,
    CategoriesModule,
    SiteModule,
    DocumentsModule,
  ],
  controllers: [DocsController],
  providers: [SeedService],
})
export class DocsModule {}
