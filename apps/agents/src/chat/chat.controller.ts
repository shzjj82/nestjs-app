import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { AgentsHandleLogInterceptor, ApiDoc, MQTT_PATTERNS } from '@app/common';
import { agentsPattern } from '../common/rpc';
import { ChatService } from './chat.service';

@Controller()
@UseInterceptors(AgentsHandleLogInterceptor)
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @MessagePattern(agentsPattern(MQTT_PATTERNS.AGENTS_CHAT_STATUS))
  @ApiDoc({ name: '智能体状态', description: '返回是否已配置模型，不回密钥' })
  status() {
    return this.chat.status();
  }

  @MessagePattern(agentsPattern(MQTT_PATTERNS.AGENTS_CHAT))
  @ApiDoc({
    name: '对话',
    description: 'sync 默认 true 一次返回 reply；sync=false 时网关 SSE 流式转给前端',
  })
  complete(payload: unknown) {
    return this.chat.complete(payload);
  }
}
