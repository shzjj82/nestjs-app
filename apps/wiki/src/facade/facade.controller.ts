import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import {
  ApiDoc,
  DocsHandleLogInterceptor,
  MQTT_GROUPS,
  MQTT_PATTERNS,
  sharePattern,
} from '@app/common';
import { PlatformProxy } from './platform-proxy';

/**
 * 编辑器产品门面：HTTP /wiki/* → 本服务 → 平台 upload / agents / notify。
 * 后续 wiki 专属逻辑写在这里（配额、审计、默认 prefix 等），再转发下游。
 */
@Controller()
@UseInterceptors(DocsHandleLogInterceptor)
export class FacadeController {
  constructor(private readonly platform: PlatformProxy) {}

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_UPLOAD_PUT))
  @ApiDoc({ name: 'Wiki 上传', description: '编辑器上传，转发 upload 服务' })
  uploadPut(payload: Record<string, unknown>) {
    return this.platform.callUpload(MQTT_PATTERNS.UPLOAD_PUT, payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_UPLOAD_ENQUEUE))
  @ApiDoc({ name: 'Wiki 异步上传', description: '编辑器异步上传，转发 upload 服务' })
  uploadEnqueue(payload: Record<string, unknown>) {
    return this.platform.callUpload(MQTT_PATTERNS.UPLOAD_ENQUEUE, payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_UPLOAD_JOB))
  uploadJob(payload: Record<string, unknown>) {
    return this.platform.callUpload(MQTT_PATTERNS.UPLOAD_JOB, payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_UPLOAD_DELETE))
  uploadDelete(payload: Record<string, unknown>) {
    return this.platform.callUpload(MQTT_PATTERNS.UPLOAD_DELETE, payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_AGENTS_CHAT))
  @ApiDoc({ name: 'Wiki 对话', description: '编辑器对话，转发 agents' })
  agentsChat(payload: Record<string, unknown>) {
    return this.platform.callAgents(MQTT_PATTERNS.AGENTS_CHAT, payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_AGENTS_CHAT_STATUS))
  agentsChatStatus(payload: Record<string, unknown>) {
    return this.platform.callAgents(MQTT_PATTERNS.AGENTS_CHAT_STATUS, payload);
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_AGENTS_CONVERSATION_LIST),
  )
  agentsConversationList(payload: Record<string, unknown>) {
    return this.platform.callAgents(MQTT_PATTERNS.AGENTS_CONVERSATION_LIST, payload);
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_AGENTS_CONVERSATION_FIND_ONE),
  )
  agentsConversationFindOne(payload: Record<string, unknown>) {
    return this.platform.callAgents(
      MQTT_PATTERNS.AGENTS_CONVERSATION_FIND_ONE,
      payload,
    );
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_AGENTS_CONVERSATION_UPDATE),
  )
  agentsConversationUpdate(payload: Record<string, unknown>) {
    return this.platform.callAgents(
      MQTT_PATTERNS.AGENTS_CONVERSATION_UPDATE,
      payload,
    );
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_AGENTS_CONVERSATION_DELETE),
  )
  agentsConversationDelete(payload: Record<string, unknown>) {
    return this.platform.callAgents(
      MQTT_PATTERNS.AGENTS_CONVERSATION_DELETE,
      payload,
    );
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_AGENTS_RAG_SEARCH))
  agentsRagSearch(payload: Record<string, unknown>) {
    return this.platform.callAgents(MQTT_PATTERNS.AGENTS_RAG_SEARCH, payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_AGENTS_VISION))
  agentsVision(payload: Record<string, unknown>) {
    return this.platform.callAgents(MQTT_PATTERNS.AGENTS_VISION_PARSE, payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_NOTIFY_LIST))
  notifyList(payload: Record<string, unknown>) {
    return this.platform.callNotify(MQTT_PATTERNS.NOTIFY_LIST, payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_NOTIFY_UNREAD_COUNT))
  notifyUnread(payload: Record<string, unknown>) {
    return this.platform.callNotify(MQTT_PATTERNS.NOTIFY_UNREAD_COUNT, payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_NOTIFY_FIND_ONE))
  notifyFindOne(payload: Record<string, unknown>) {
    return this.platform.callNotify(MQTT_PATTERNS.NOTIFY_FIND_ONE, payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_NOTIFY_READ))
  notifyRead(payload: Record<string, unknown>) {
    return this.platform.callNotify(MQTT_PATTERNS.NOTIFY_READ, payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_NOTIFY_READ_ALL))
  notifyReadAll(payload: Record<string, unknown>) {
    return this.platform.callNotify(MQTT_PATTERNS.NOTIFY_READ_ALL, payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_TODO_LIST))
  todoList(payload: Record<string, unknown>) {
    return this.platform.callNotify(MQTT_PATTERNS.TODO_LIST, payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_TODO_OPEN_COUNT))
  todoOpenCount(payload: Record<string, unknown>) {
    return this.platform.callNotify(MQTT_PATTERNS.TODO_OPEN_COUNT, payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_TODO_FIND_ONE))
  todoFindOne(payload: Record<string, unknown>) {
    return this.platform.callNotify(MQTT_PATTERNS.TODO_FIND_ONE, payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_TODO_CREATE))
  todoCreate(payload: Record<string, unknown>) {
    return this.platform.callNotify(MQTT_PATTERNS.TODO_CREATE, payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_TODO_UPDATE))
  todoUpdate(payload: Record<string, unknown>) {
    return this.platform.callNotify(MQTT_PATTERNS.TODO_UPDATE, payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_TODO_DONE))
  todoDone(payload: Record<string, unknown>) {
    return this.platform.callNotify(MQTT_PATTERNS.TODO_DONE, payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_TODO_CANCEL))
  todoCancel(payload: Record<string, unknown>) {
    return this.platform.callNotify(MQTT_PATTERNS.TODO_CANCEL, payload);
  }
}
