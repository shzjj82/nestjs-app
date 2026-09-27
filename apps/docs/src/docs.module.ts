import { Module } from '@nestjs/common';
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
  ],
  controllers: [DocsController],
  providers: [SeedService],
})
export class DocsModule {}
