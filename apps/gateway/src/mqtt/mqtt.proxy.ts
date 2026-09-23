import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom, TimeoutError } from 'rxjs';
import { timeout } from 'rxjs/operators';

const MQTT_TIMEOUT_MS = Number(process.env.MQTT_TIMEOUT_MS ?? 5000);

@Injectable()
export class MqttProxy {
  send<T>(client: ClientProxy, pattern: string, data: unknown = {}) {
    return lastValueFrom(
      client.send<T>(pattern, data).pipe(timeout(MQTT_TIMEOUT_MS)),
    ).catch((err: unknown) => {
      throw this.toHttpError(pattern, err);
    });
  }

  private toHttpError(pattern: string, err: unknown): Error {
    if (err instanceof TimeoutError) {
      return new GatewayTimeoutException(`MQTT 请求超时: ${pattern}`);
    }

    const payload = this.asRecord(err);
    if (payload?.status === 404) {
      return new NotFoundException(String(payload.message ?? '资源不存在'));
    }

    return new BadGatewayException(
      String(payload?.message ?? (err instanceof Error ? err.message : '微服务调用失败')),
    );
  }

  private asRecord(err: unknown): { status?: number; message?: string } | null {
    if (typeof err === 'object' && err !== null) {
      return err as { status?: number; message?: string };
    }
    return null;
  }
}
