import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import {
  AgentsHandleLogInterceptor,
  ApiDoc,
  MQTT_GROUPS,
  MQTT_PATTERNS,
  sharePattern,
} from '@app/common';
import { ConversationService } from './conversation.service';

@Controller()
@UseInterceptors(AgentsHandleLogInterceptor)
export class ConversationController {
  constructor(private readonly conversations: ConversationService) {}

  @MessagePattern(sharePattern(MQTT_GROUPS.AGENTS, MQTT_PATTERNS.AGENTS_CONVERSATION_LIST))
  @ApiDoc({ name: '会话列表', description: '当前业务下本人的 AI 对话会话，按更新时间倒序' })
  list(payload: unknown) {
    return this.conversations.list(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.AGENTS, MQTT_PATTERNS.AGENTS_CONVERSATION_FIND_ONE))
  @ApiDoc({ name: '会话详情', description: '会话信息与全部消息' })
  findOne(payload: unknown) {
    return this.conversations.findOne(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.AGENTS, MQTT_PATTERNS.AGENTS_CONVERSATION_UPDATE))
  @ApiDoc({ name: '重命名会话', description: '修改会话标题' })
  update(payload: unknown) {
    return this.conversations.rename(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.AGENTS, MQTT_PATTERNS.AGENTS_CONVERSATION_DELETE))
  @ApiDoc({ name: '删除会话', description: '删除会话及其消息' })
  remove(payload: unknown) {
    return this.conversations.remove(payload);
  }
}
