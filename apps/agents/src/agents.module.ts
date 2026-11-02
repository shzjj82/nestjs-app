import { Module } from '@nestjs/common';
import { ApiDocsModule, MQTT_GROUPS, MQTT_PATTERNS, sharePattern } from '@app/common';
import { AgentsController } from './agents.controller';
import { ChatModule } from './chat/chat.module';
import { LanguageModule } from './language/language.module';
import { MediaModule } from './media/media.module';
import { RagModule } from './rag/rag.module';
import { SpeechModule } from './speech/speech.module';
import { VideoModule } from './video/video.module';
import { VisionModule } from './vision/vision.module';

@Module({
  imports: [
    ChatModule,
    RagModule,
    VisionModule,
    MediaModule,
    SpeechModule,
    VideoModule,
    LanguageModule,
    ApiDocsModule.forService({
      service: 'agents',
      label: '智能体模块',
      pattern: sharePattern(MQTT_GROUPS.AGENTS, MQTT_PATTERNS.AGENTS_API_DOCS),
    }),
  ],
  controllers: [AgentsController],
})
export class AgentsModule {}
