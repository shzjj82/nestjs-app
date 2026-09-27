import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { MQTT_PATTERNS, UploadHandleLogInterceptor } from '@app/common';
import { uploadPattern } from '../common/rpc';
import { ObjectsService } from './objects.service';

@Controller()
@UseInterceptors(UploadHandleLogInterceptor)
export class ObjectsController {
  constructor(private readonly objects: ObjectsService) {}

  @MessagePattern(uploadPattern(MQTT_PATTERNS.UPLOAD_PUT))
  put(payload: unknown) {
    return this.objects.put(payload);
  }

  @MessagePattern(uploadPattern(MQTT_PATTERNS.UPLOAD_DELETE))
  remove(payload: unknown) {
    return this.objects.remove(payload);
  }
}
