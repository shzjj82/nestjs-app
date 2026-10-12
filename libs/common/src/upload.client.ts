import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom, TimeoutError } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { unwrapData } from './http';
import { MQTT_PATTERNS, UPLOAD_CLIENT } from './patterns';
import { rpcFail } from './rpc';

/** 通过 MQTT 调 upload.put，各业务服务共用 */
@Injectable()
export class UploadClient implements OnModuleInit {
  constructor(@Inject(UPLOAD_CLIENT) private readonly upload: ClientProxy) {}

  async onModuleInit() {
    await this.upload.connect();
  }

  async put(input: {
    bizCode: string;
    filename: string;
    contentType: string;
    base64: string;
    prefix?: string;
  }): Promise<{ url: string; key: string }> {
    try {
      const raw = await lastValueFrom(
        this.upload
          .send(MQTT_PATTERNS.UPLOAD_PUT, {
            filename: input.filename,
            contentType: input.contentType,
            prefix: input.prefix ?? 'uploads',
            base64: input.base64,
            _bizCode: input.bizCode,
          })
          .pipe(timeout(15000)),
      );
      const stored = unwrapData<{ url: string; key: string }>(raw);
      if (!stored?.url || !stored?.key) {
        rpcFail(502, '上传服务未返回文件地址');
      }
      return { url: stored.url, key: stored.key };
    } catch (err) {
      if (err instanceof TimeoutError) {
        rpcFail(504, '上传服务超时');
      }
      const payload = err as { status?: number; message?: string };
      rpcFail(payload?.status ?? 502, payload?.message ?? '上传文件失败');
    }
  }
}
