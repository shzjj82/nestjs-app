import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { MQTT_PATTERNS, UPLOAD_CLIENT } from '@app/common';
import { callDownstream } from '../common/downstream';

/** 编辑器附件：直传、异步任务、删除。 */
@Injectable()
export class WikiUploadService implements OnModuleInit {
  constructor(@Inject(UPLOAD_CLIENT) private readonly upload: ClientProxy) {}

  async onModuleInit() {
    await this.upload.connect();
  }

  put(payload: Record<string, unknown>) {
    return this.call(MQTT_PATTERNS.UPLOAD_PUT, payload);
  }

  enqueue(payload: Record<string, unknown>) {
    return this.call(MQTT_PATTERNS.UPLOAD_ENQUEUE, payload);
  }

  job(payload: Record<string, unknown>) {
    return this.call(MQTT_PATTERNS.UPLOAD_JOB, payload);
  }

  remove(payload: Record<string, unknown>) {
    return this.call(MQTT_PATTERNS.UPLOAD_DELETE, payload);
  }

  private call(pattern: string, payload: Record<string, unknown>) {
    return callDownstream(this.upload, pattern, payload, 30_000, '上传服务不可用');
  }
}
