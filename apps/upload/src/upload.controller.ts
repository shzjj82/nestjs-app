import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { instanceId, MQTT_PATTERNS, UploadHandleLogInterceptor } from '@app/common';
import { uploadPattern } from './common/rpc';
import { StorageService } from './storage/storage.service';

@Controller()
@UseInterceptors(UploadHandleLogInterceptor)
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
