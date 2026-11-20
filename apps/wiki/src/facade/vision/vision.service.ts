import { Injectable } from '@nestjs/common';
import { MQTT_PATTERNS } from '@app/common';
import { PlatformProxy } from '../platform-proxy';

/** 编辑器识图，不和对话共用处理。 */
@Injectable()
export class WikiVisionService {
  constructor(private readonly platform: PlatformProxy) {}

  parse(payload: Record<string, unknown>) {
    return this.platform.callAgents(MQTT_PATTERNS.AGENTS_VISION_PARSE, payload);
  }
}
