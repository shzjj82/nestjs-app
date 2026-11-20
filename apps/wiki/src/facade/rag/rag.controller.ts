import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { DocsHandleLogInterceptor, MQTT_GROUPS, MQTT_PATTERNS, sharePattern } from '@app/common';
import { WikiRagService } from './rag.service';

@Controller()
@UseInterceptors(DocsHandleLogInterceptor)
export class WikiRagController {
  constructor(private readonly rag: WikiRagService) {}

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_AGENTS_RAG_SEARCH))
  search(payload: Record<string, unknown>) {
    return this.rag.search(payload);
  }
}
