import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  AGENTS_CLIENT,
  NOTIFY_CLIENT,
  UPLOAD_CLIENT,
  unwrapData,
} from '@app/common';
import { lastValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { rpcFail } from '../common/rpc';

/** wiki 门面调平台微服务；业务扩展点集中在各 facade controller */
@Injectable()
export class PlatformProxy implements OnModuleInit {
  constructor(
    @Inject(UPLOAD_CLIENT) private readonly upload: ClientProxy,
    @Inject(AGENTS_CLIENT) private readonly agents: ClientProxy,
    @Inject(NOTIFY_CLIENT) private readonly notify: ClientProxy,
  ) {}

  async onModuleInit() {
    await Promise.all([
      this.upload.connect(),
      this.agents.connect(),
      this.notify.connect(),
    ]);
  }

  callUpload<T = unknown>(pattern: string, payload: unknown, ms = 30_000) {
    return this.send<T>(this.upload, pattern, payload, ms);
  }

  callAgents<T = unknown>(pattern: string, payload: unknown, ms = 90_000) {
    return this.send<T>(this.agents, pattern, payload, ms);
  }

  callNotify<T = unknown>(pattern: string, payload: unknown, ms = 15_000) {
    return this.send<T>(this.notify, pattern, payload, ms);
  }

  private async send<T>(
    client: ClientProxy,
    pattern: string,
    payload: unknown,
    ms: number,
  ): Promise<T> {
    try {
      const raw = await lastValueFrom(
        client.send(pattern, payload).pipe(timeout(ms)),
      );
      return unwrapData<T>(raw);
    } catch (err) {
      const status = rpcStatus(err);
      if (status) {
        rpcFail(status.code, status.message);
      }
      rpcFail(503, '下游服务不可用');
    }
  }
}

function rpcStatus(err: unknown): { code: number; message: string } | null {
  if (typeof err !== 'object' || err === null) {
    return null;
  }
  const record = err as {
    status?: number;
    message?: string;
    error?: { status?: number; message?: string };
  };
  const source = record.error?.status ? record.error : record;
  if (typeof source.status === 'number' && source.message) {
    return { code: source.status, message: String(source.message) };
  }
  return null;
}
