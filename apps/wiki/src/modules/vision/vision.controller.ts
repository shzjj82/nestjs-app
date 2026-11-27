import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { DocsHandleLogInterceptor, MQTT_GROUPS, MQTT_PATTERNS, sharePattern } from '@app/common';
import { WikiVisionService } from './vision.service';

@Controller()
@UseInterceptors(DocsHandleLogInterceptor)
export class WikiVisionController {
  constructor(private readonly vision: WikiVisionService) {}

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_AGENTS_VISION))
  parse(payload: Record<string, unknown>) {
    return this.vision.parse(payload);
  }
}
