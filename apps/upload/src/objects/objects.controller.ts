import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { ApiDoc, MQTT_PATTERNS, UploadHandleLogInterceptor } from '@app/common';
import { uploadPattern } from '../common/rpc';
import { ObjectsService } from './objects.service';

@Controller()
@UseInterceptors(UploadHandleLogInterceptor)
export class ObjectsController {
  constructor(private readonly objects: ObjectsService) {}

  @MessagePattern(uploadPattern(MQTT_PATTERNS.UPLOAD_PUT))
  @ApiDoc({ name: '上传文件', description: '同步上传，对象键落在业务目录下' })
  put(payload: unknown) {
    return this.objects.put(payload);
  }

  @MessagePattern(uploadPattern(MQTT_PATTERNS.UPLOAD_DELETE))
  @ApiDoc({ name: '删除文件' })
  remove(payload: unknown) {
    return this.objects.remove(payload);
  }
}
