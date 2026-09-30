import { Module } from '@nestjs/common';
import { ApiDocsModule, MQTT_GROUPS, MQTT_PATTERNS, sharePattern } from '@app/common';
import { AgentsController } from './agents.controller';
import { ChatModule } from './chat/chat.module';

@Module({
  imports: [
    ChatModule,
    ApiDocsModule.forService({
      service: 'agents',
      label: '智能体模块',
      pattern: sharePattern(MQTT_GROUPS.AGENTS, MQTT_PATTERNS.AGENTS_API_DOCS),
    }),
  ],
  controllers: [AgentsController],
})
export class AgentsModule {}
