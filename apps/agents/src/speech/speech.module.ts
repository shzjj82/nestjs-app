import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { SpeechController } from './speech.controller';
import { SpeechService } from './speech.service';

@Module({
  imports: [MediaModule],
  controllers: [SpeechController],
  providers: [SpeechService],
})
export class SpeechModule {}
