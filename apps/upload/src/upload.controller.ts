import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { MQTT_PATTERNS, serviceHealth, UploadHandleLogInterceptor, sharePattern, MQTT_GROUPS } from '@app/common';
import { StorageService } from './storage/storage.service';

@Controller()
@UseInterceptors(UploadHandleLogInterceptor)
export class UploadController {
  constructor(private readonly storage: StorageService) {}

  @MessagePattern(sharePattern(MQTT_GROUPS.UPLOAD, MQTT_PATTERNS.UPLOAD_HEALTH))
  async health() {
    const storage = this.storage.status();
    return serviceHealth('upload', {
      storage: {
        ...storage,
        reachable: storage.ready ? await this.storage.ping() : false,
      },
    });
  }
}
