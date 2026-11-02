import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { AgentsHandleLogInterceptor, ApiDoc, MQTT_PATTERNS } from '@app/common';
import { agentsPattern } from '../common/rpc';
import { SpeechService } from './speech.service';

@Controller()
@UseInterceptors(AgentsHandleLogInterceptor)
export class SpeechController {
  constructor(private readonly speech: SpeechService) {}

  @MessagePattern(agentsPattern(MQTT_PATTERNS.AGENTS_SPEECH_TRANSCRIBE))
  @ApiDoc({
    name: '语音转写',
    description: '短录音走通义 ASR 同步返回；fileUrl / 视频走听悟任务',
  })
  transcribe(payload: unknown) {
    return this.speech.transcribe(payload);
  }
}
