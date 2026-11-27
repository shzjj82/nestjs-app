import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { AGENTS_CLIENT, MQTT_PATTERNS } from '@app/common';
import { callDownstream } from '../../common/downstream';

/** 编辑器识图。 */
@Injectable()
export class WikiVisionService implements OnModuleInit {
  constructor(@Inject(AGENTS_CLIENT) private readonly agents: ClientProxy) {}

  async onModuleInit() {
    await this.agents.connect();
  }

  parse(payload: Record<string, unknown>) {
    return callDownstream(
      this.agents,
      MQTT_PATTERNS.AGENTS_VISION_PARSE,
      payload,
      90_000,
      '识图服务不可用',
    );
  }
}
