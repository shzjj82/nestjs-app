import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import {
  ApiDoc,
  DocsHandleLogInterceptor,
  MQTT_GROUPS,
  MQTT_PATTERNS,
  sharePattern,
} from '@app/common';
import { WikiUploadService } from './upload.service';

@Controller()
@UseInterceptors(DocsHandleLogInterceptor)
export class WikiUploadController {
  constructor(private readonly uploads: WikiUploadService) {}

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_UPLOAD_PUT))
  @ApiDoc({ name: 'Wiki 上传', description: '编辑器上传，转发 upload 服务' })
  put(payload: Record<string, unknown>) {
    return this.uploads.put(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_UPLOAD_ENQUEUE))
  @ApiDoc({ name: 'Wiki 异步上传', description: '编辑器异步上传，转发 upload 服务' })
  enqueue(payload: Record<string, unknown>) {
    return this.uploads.enqueue(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_UPLOAD_JOB))
  job(payload: Record<string, unknown>) {
    return this.uploads.job(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_UPLOAD_DELETE))
  remove(payload: Record<string, unknown>) {
    return this.uploads.remove(payload);
  }
}
