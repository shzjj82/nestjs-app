import { Module } from '@nestjs/common';
import { SharedModule } from '../common/shared.module';
import { DocumentsModule } from '../documents/documents.module';
import { SiteController } from './site.controller';
import { SiteService } from './site.service';

@Module({
  imports: [SharedModule, DocumentsModule],
  controllers: [SiteController],
  providers: [SiteService],
  exports: [SiteService],
})
export class SiteModule {}
