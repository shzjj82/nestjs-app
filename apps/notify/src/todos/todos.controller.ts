import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { ApiDoc, MQTT_PATTERNS, NotifyHandleLogInterceptor, sharePattern, MQTT_GROUPS } from '@app/common';
import { parseSend, requireActor, requireInternal } from '../common/input';
import { TodosService } from './todos.service';

@Controller()
@UseInterceptors(NotifyHandleLogInterceptor)
export class TodosController {
  constructor(private readonly todos: TodosService) {}

  @MessagePattern(sharePattern(MQTT_GROUPS.NOTIFY, MQTT_PATTERNS.TODO_LIST))
  @ApiDoc({ name: '我的待办', description: '当前业务下本人的待办，可用 status=open|done|cancelled 过滤' })
  list(payload: Record<string, unknown>) {
    return this.todos.list(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.NOTIFY, MQTT_PATTERNS.TODO_OPEN_COUNT))
  @ApiDoc({ name: '未完成数量', description: '当前业务下本人 status=open 的待办数' })
  openCount(payload: Record<string, unknown>) {
    return this.todos.openCount(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.NOTIFY, MQTT_PATTERNS.TODO_FIND_ONE))
  @ApiDoc({ name: '待办详情', description: '只能读取本人在当前业务下的待办' })
  findOne(payload: Record<string, unknown>) {
    return this.todos.findOne(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.NOTIFY, MQTT_PATTERNS.TODO_CREATE))
  @ApiDoc({ name: '新建待办', description: '给当前登录用户自己建一条待办，并经 socket 推送' })
  createMine(payload: Record<string, unknown>) {
    return this.todos.createMine(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.NOTIFY, MQTT_PATTERNS.TODO_DONE))
  @ApiDoc({ name: '完成待办', description: '把本人的一条未完成待办标为 done，并经 socket 推送' })
  done(payload: Record<string, unknown>) {
    return this.todos.finish(payload, 'done');
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.NOTIFY, MQTT_PATTERNS.TODO_CANCEL))
  @ApiDoc({ name: '取消待办', description: '把本人的一条未完成待办标为 cancelled，并经 socket 推送' })
  cancel(payload: Record<string, unknown>) {
    return this.todos.finish(payload, 'cancel');
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.NOTIFY, MQTT_PATTERNS.TODO_ADMIN_CREATE))
  @ApiDoc({
    name: '指派待办',
    description: '向指定业务下的用户创建待办，并经 socket 推送',
  })
  adminCreate(payload: Record<string, unknown>) {
    requireActor(payload);
    return this.todos.create(parseSend(payload, 'admin'));
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.NOTIFY, MQTT_PATTERNS.TODO_SEND))
  send(payload: Record<string, unknown>) {
    requireInternal(payload);
    return this.todos.create(parseSend(payload, 'service'));
  }
}
