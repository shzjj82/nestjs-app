import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { DocsHandleLogInterceptor, MQTT_PATTERNS, serviceHealth, sharePattern, MQTT_GROUPS } from '@app/common';

@Controller()
@UseInterceptors(DocsHandleLogInterceptor)
export class WikiController {
  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_HEALTH))
  health() {
    return serviceHealth('wiki');
  }
}
