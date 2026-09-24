import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GatewayTimeoutException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom, TimeoutError } from 'rxjs';
import { timeout } from 'rxjs/operators';

const MQTT_TIMEOUT_MS = Number(process.env.MQTT_TIMEOUT_MS ?? 30000);

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
    const message = String(payload?.message ?? (err instanceof Error ? err.message : '微服务调用失败'));
    switch (payload?.status) {
      case 400:
        return new BadRequestException(message);
      case 401:
        return new UnauthorizedException(message);
      case 403:
        return new ForbiddenException(message);
      case 404:
        return new NotFoundException(message);
      case 409:
        return new ConflictException(message);
      case 503:
        return new ServiceUnavailableException(message);
      default:
        return new BadGatewayException(message);
    }
  }

  private asRecord(err: unknown): { status?: number; message?: string } | null {
    if (typeof err !== 'object' || err === null) {
      return null;
    }
    const record = err as {
      status?: number;
      message?: string;
      error?: { status?: number; message?: string };
    };
    if (record.error && (record.error.status || record.error.message)) {
      return record.error;
    }
    return record;
  }
}
