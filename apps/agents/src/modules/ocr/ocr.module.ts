import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { PromptsModule } from '../prompts/prompts.module';
import { OcrController } from './ocr.controller';
import { OcrHttpController } from './ocr-http.controller';
import { OcrService } from './ocr.service';

@Module({
  imports: [DatabaseModule, PromptsModule],
  controllers: [OcrController, OcrHttpController],
  providers: [OcrService],
  exports: [OcrService],
})
export class OcrModule {}
