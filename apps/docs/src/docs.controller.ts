import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { instanceId, MQTT_PATTERNS } from '@app/common';
import { HandleLogInterceptor } from './common/handle-log.interceptor';
import { docsPattern } from './common/rpc';

@Controller()
@UseInterceptors(HandleLogInterceptor)
export class DocsController {
  @MessagePattern(docsPattern(MQTT_PATTERNS.DOC_HEALTH))
  health() {
    return { status: 'up', instance: instanceId('docs') };
  }
}
