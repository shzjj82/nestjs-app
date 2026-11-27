import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { AGENTS_CLIENT, MQTT_PATTERNS } from '@app/common';
import { callDownstream } from '../../common/downstream';

/** 编辑器里的文章检索。 */
@Injectable()
export class WikiRagService implements OnModuleInit {
  constructor(@Inject(AGENTS_CLIENT) private readonly agents: ClientProxy) {}

  async onModuleInit() {
    await this.agents.connect();
  }

  search(payload: Record<string, unknown>) {
    return callDownstream(
      this.agents,
      MQTT_PATTERNS.AGENTS_RAG_SEARCH,
      payload,
      90_000,
      '检索服务不可用',
    );
  }
}
