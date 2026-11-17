import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import {
  ApiDoc,
  DocsHandleLogInterceptor,
  MQTT_GROUPS,
  MQTT_PATTERNS,
  sharePattern,
} from '@app/common';
import { OpLogService } from './op-log.service';

@Controller()
@UseInterceptors(DocsHandleLogInterceptor)
export class OpLogController {
  constructor(private readonly opLogs: OpLogService) {}

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_OP_LOG_LIST))
  @ApiDoc({
    name: 'Wiki 操作日志',
    description: '按资源/操作人/动作过滤业务操作日志（只读）',
  })
  list(payload: Record<string, unknown>) {
    return this.opLogs.list(payload);
  }
}
