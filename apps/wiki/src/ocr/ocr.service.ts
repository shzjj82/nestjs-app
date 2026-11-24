import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { AGENTS_CLIENT, MQTT_PATTERNS } from '@app/common';
import { callDownstream } from '../common/downstream';

const SYNC_MS = 180_000;

/** 编辑器图片识别。同步等待、异步任务、查询任务。SSE 由网关直连 agents。 */
@Injectable()
export class WikiOcrService implements OnModuleInit {
  constructor(@Inject(AGENTS_CLIENT) private readonly agents: ClientProxy) {}

  async onModuleInit() {
    await this.agents.connect();
  }

  recognize(payload: Record<string, unknown>) {
    return callDownstream(this.agents, MQTT_PATTERNS.AGENTS_OCR, payload, SYNC_MS, '识图服务不可用');
  }

  createTask(payload: Record<string, unknown>) {
    return callDownstream(
      this.agents,
      MQTT_PATTERNS.AGENTS_OCR_TASK_CREATE,
      payload,
      15_000,
      '识图服务不可用',
    );
  }

  findTask(payload: Record<string, unknown>) {
    return callDownstream(
      this.agents,
      MQTT_PATTERNS.AGENTS_OCR_TASK_FIND,
      payload,
      15_000,
      '识图服务不可用',
    );
  }
}
