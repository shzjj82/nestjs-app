import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { OcrController } from './ocr.controller';
import { OcrHttpController } from './ocr-http.controller';
import { OcrService } from './ocr.service';

@Module({
  imports: [DatabaseModule],
  controllers: [OcrController, OcrHttpController],
  providers: [OcrService],
  exports: [OcrService],
})
export class OcrModule {}
