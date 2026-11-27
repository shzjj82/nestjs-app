import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { RECYCLE_BIZ_CODE, USER_CLIENT, rpcFail, unwrapData } from '@app/common';
import { lastValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';

/** 回收登录门面：强制 _bizCode=recycle 后转发 usercenter */
@Injectable()
export class AuthProxy {
  constructor(@Inject(USER_CLIENT) private readonly usercenter: ClientProxy) {}

  callAuth<T = unknown>(pattern: string, payload: Record<string, unknown>, ms = 15_000) {
    return this.send<T>(pattern, { ...payload, _bizCode: RECYCLE_BIZ_CODE }, ms);
  }

  private async send<T>(pattern: string, payload: unknown, ms: number): Promise<T> {
    try {
      const raw = await lastValueFrom(
        this.usercenter.send(pattern, payload).pipe(timeout(ms)),
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
