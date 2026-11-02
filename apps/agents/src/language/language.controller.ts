import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { AgentsHandleLogInterceptor, ApiDoc, MQTT_PATTERNS } from '@app/common';
import { agentsPattern } from '../common/rpc';
import { LanguageService } from './language.service';

@Controller()
@UseInterceptors(AgentsHandleLogInterceptor)
export class LanguageController {
  constructor(private readonly language: LanguageService) {}

  @MessagePattern(agentsPattern(MQTT_PATTERNS.AGENTS_LANGUAGE_EXTRACT))
  @ApiDoc({
    name: '语言抽取',
    description: '按调用方传入的 system/user 抽取 JSON，业务字段由上游决定',
  })
  extract(payload: unknown) {
    return this.language.extract(payload);
  }

  @MessagePattern(agentsPattern(MQTT_PATTERNS.AGENTS_LANGUAGE_COMPLETE))
  @ApiDoc({
    name: '语言补全',
    description: '通用对话补全，可带 tools；模型密钥只在 agents 侧',
  })
  complete(payload: unknown) {
    return this.language.complete(payload);
  }
}
