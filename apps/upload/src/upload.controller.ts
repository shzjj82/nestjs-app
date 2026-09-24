import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { instanceId, MQTT_PATTERNS } from '@app/common';
import { HandleLogInterceptor } from './common/handle-log.interceptor';
import { uploadPattern } from './common/rpc';
import { StorageService } from './storage/storage.service';

@Controller()
@UseInterceptors(HandleLogInterceptor)
export class UploadController {
  constructor(private readonly storage: StorageService) {}

  @MessagePattern(uploadPattern(MQTT_PATTERNS.UPLOAD_HEALTH))
  async health() {
    const storage = this.storage.status();
    return {
      status: 'up',
      instance: instanceId('upload'),
      storage: {
        ...storage,
        reachable: storage.ready ? await this.storage.ping() : false,
      },
    };
  }
}
