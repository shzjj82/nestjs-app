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
  @ApiDoc({
    name: '我的待办',
    description:
      '当前业务下本人的待办；status 支持多值：pending,in_progress 或重复 query；也兼容旧 open（=pending+in_progress）',
  })
  list(payload: Record<string, unknown>) {
    return this.todos.list(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.NOTIFY, MQTT_PATTERNS.TODO_OPEN_COUNT))
  @ApiDoc({
    name: '未完成数量',
    description: '当前业务下本人 pending + in_progress 的待办数（含过渡 open）',
  })
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

  @MessagePattern(sharePattern(MQTT_GROUPS.NOTIFY, MQTT_PATTERNS.TODO_UPDATE))
  @ApiDoc({
    name: '更新待办',
    description: '更新本人待办的标题、内容、开始/截止日与 status',
  })
  updateMine(payload: Record<string, unknown>) {
    return this.todos.updateMine(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.NOTIFY, MQTT_PATTERNS.TODO_START))
  @ApiDoc({ name: '开始待办', description: 'pending → in_progress，写入 startedAt' })
  start(payload: Record<string, unknown>) {
    return this.todos.start(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.NOTIFY, MQTT_PATTERNS.TODO_DONE))
  @ApiDoc({ name: '完成待办', description: '把本人的一条活跃待办标为 done，并经 socket 推送' })
  done(payload: Record<string, unknown>) {
    return this.todos.finish(payload, 'done');
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.NOTIFY, MQTT_PATTERNS.TODO_CANCEL))
  @ApiDoc({ name: '取消待办', description: '把本人的一条活跃待办标为 cancelled，并经 socket 推送' })
  cancel(payload: Record<string, unknown>) {
    return this.todos.finish(payload, 'cancel');
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.NOTIFY, MQTT_PATTERNS.TODO_REOPEN))
  @ApiDoc({
    name: '重新打开待办',
    description: 'done/cancelled → pending 或 in_progress（按 startsAt 与今天）',
  })
  reopen(payload: Record<string, unknown>) {
    return this.todos.reopen(payload);
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

  @MessagePattern(sharePattern(MQTT_GROUPS.NOTIFY, MQTT_PATTERNS.TODO_PATCH_DATA))
  @ApiDoc({
    name: '补丁待办 data',
    description: '内部接口：任意状态待办只更新 data，供 wiki 回填页面关联',
  })
  patchData(payload: Record<string, unknown>) {
    requireInternal(payload);
    return this.todos.patchData(payload);
  }
}
