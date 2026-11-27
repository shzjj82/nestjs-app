import { ClientProxy } from '@nestjs/microservices';
import { unwrapData } from '@app/common';
import { lastValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { rpcFail } from '@app/common';

export async function callDownstream<T>(
  client: ClientProxy,
  pattern: string,
  payload: unknown,
  ms: number,
  unavailable = '下游服务不可用',
): Promise<T> {
  try {
    const raw = await lastValueFrom(client.send(pattern, payload).pipe(timeout(ms)));
    return unwrapData<T>(raw);
  } catch (err) {
    const status = downstreamStatus(err);
    if (status) {
      rpcFail(status.code, status.message);
    }
    rpcFail(503, unavailable);
  }
}

function downstreamStatus(err: unknown): { code: number; message: string } | null {
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
