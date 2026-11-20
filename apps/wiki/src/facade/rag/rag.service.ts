import { Injectable } from '@nestjs/common';
import { MQTT_PATTERNS } from '@app/common';
import { PlatformProxy } from '../platform-proxy';

/** 编辑器里的文章检索，和对话、识图分开。 */
@Injectable()
export class WikiRagService {
  constructor(private readonly platform: PlatformProxy) {}

  search(payload: Record<string, unknown>) {
    return this.platform.callAgents(MQTT_PATTERNS.AGENTS_RAG_SEARCH, payload);
  }
}
