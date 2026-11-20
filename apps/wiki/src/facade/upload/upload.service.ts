import { Injectable } from '@nestjs/common';
import { MQTT_PATTERNS } from '@app/common';
import { PlatformProxy } from '../platform-proxy';

/** 编辑器附件：直传、异步任务、删除。超时按上传体积放宽。 */
@Injectable()
export class WikiUploadService {
  constructor(private readonly platform: PlatformProxy) {}

  put(payload: Record<string, unknown>) {
    return this.platform.callUpload(MQTT_PATTERNS.UPLOAD_PUT, payload);
  }

  enqueue(payload: Record<string, unknown>) {
    return this.platform.callUpload(MQTT_PATTERNS.UPLOAD_ENQUEUE, payload);
  }

  job(payload: Record<string, unknown>) {
    return this.platform.callUpload(MQTT_PATTERNS.UPLOAD_JOB, payload);
  }

  remove(payload: Record<string, unknown>) {
    return this.platform.callUpload(MQTT_PATTERNS.UPLOAD_DELETE, payload);
  }
}
