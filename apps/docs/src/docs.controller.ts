import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { DocsHandleLogInterceptor, instanceId, MQTT_PATTERNS } from '@app/common';
import { docsPattern } from './common/rpc';

@Controller()
@UseInterceptors(DocsHandleLogInterceptor)
export class DocsController {
  @MessagePattern(docsPattern(MQTT_PATTERNS.DOC_HEALTH))
  health() {
    return { status: 'up', instance: instanceId('docs') };
  }
}
