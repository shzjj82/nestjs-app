import { Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';
import { AGENTS_CLIENT, mqttClientOptions } from '@app/common';
import { WikiOcrController } from './ocr.controller';
import { WikiOcrService } from './ocr.service';

@Module({
  imports: [
    ClientsModule.register([{ name: AGENTS_CLIENT, ...mqttClientOptions('wiki-ocr') }]),
  ],
  controllers: [WikiOcrController],
  providers: [WikiOcrService],
})
export class OcrModule {}
