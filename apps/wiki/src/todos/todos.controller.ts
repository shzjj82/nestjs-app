import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import {
  ApiDoc,
  DocsHandleLogInterceptor,
  MQTT_GROUPS,
  MQTT_PATTERNS,
  sharePattern,
} from '@app/common';
import { TodosService } from './todos.service';

/**
 * wiki 产品待办入口。创建必须关联文章页；列表可按 pageId 过滤；
 * 到期通知携带 data.page 供前端跳转。
 */
@Controller()
@UseInterceptors(DocsHandleLogInterceptor)
export class TodosController {
  constructor(private readonly todos: TodosService) {}

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_TODO_LIST))
  @ApiDoc({
    name: 'Wiki 我的待办',
    description: 'wiki 业务下本人待办；可传 pageId 只看某篇文章相关的待办',
  })
  list(payload: Record<string, unknown>) {
    return this.todos.list(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_TODO_OPEN_COUNT))
  @ApiDoc({ name: 'Wiki 未完成待办数' })
  openCount(payload: Record<string, unknown>) {
    return this.todos.openCount(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_TODO_FIND_ONE))
  @ApiDoc({ name: 'Wiki 待办详情', description: '结果含顶层 page，便于跳转文章' })
  findOne(payload: Record<string, unknown>) {
    return this.todos.findOne(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_TODO_CREATE))
  @ApiDoc({
    name: 'Wiki 新建待办',
    description: '必须传 pageId；校验页面可读后关联，到期通知可跳到该文',
  })
  create(payload: Record<string, unknown>) {
    return this.todos.create(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_TODO_UPDATE))
  @ApiDoc({
    name: 'Wiki 更新待办',
    description: '可传 pageId 改绑文章；未传则保留原关联',
  })
  update(payload: Record<string, unknown>) {
    return this.todos.update(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_TODO_BIND_PAGE))
  @ApiDoc({
    name: 'Wiki 待办绑定页面',
    description: '给已有待办（含已完成）补绑/改绑 pageId，写入 data.page',
  })
  bindPage(payload: Record<string, unknown>) {
    return this.todos.bindPage(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_TODO_START))
  @ApiDoc({ name: 'Wiki 开始待办', description: 'pending → in_progress' })
  start(payload: Record<string, unknown>) {
    return this.todos.start(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_TODO_DONE))
  @ApiDoc({ name: 'Wiki 完成待办' })
  done(payload: Record<string, unknown>) {
    return this.todos.done(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_TODO_CANCEL))
  @ApiDoc({ name: 'Wiki 取消待办' })
  cancel(payload: Record<string, unknown>) {
    return this.todos.cancel(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_TODO_REOPEN))
  @ApiDoc({
    name: 'Wiki 重新打开待办',
    description: 'done/cancelled → pending 或 in_progress（按 startsAt）',
  })
  reopen(payload: Record<string, unknown>) {
    return this.todos.reopen(payload);
  }
}
