import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { MQTT_PATTERNS, USER_CLIENT, type TeamRole } from '@app/common';
import { rpcFail } from '../common/rpc';

export interface TeamGrant {
  teamId: string;
  role: TeamRole;
}

@Injectable()
export class TeamAccess implements OnModuleInit {
  constructor(@Inject(USER_CLIENT) private readonly users: ClientProxy) {}

  async onModuleInit() {
    await this.users.connect();
  }

  async grants(input: {
    accountId: string;
    appCode: string;
    bizCode: string;
  }): Promise<TeamGrant[]> {
    const raw = await this.send<{ items?: TeamGrant[] }>(
      MQTT_PATTERNS.TEAM_MEMBERSHIPS,
      input,
    );
    return Array.isArray(raw?.items) ? raw.items : [];
  }

  private async send<T>(pattern: string, data: unknown): Promise<T> {
    try {
      return await lastValueFrom(
        this.users.send<T>(pattern, data).pipe(timeout(8000)),
      );
    } catch (err) {
      const status = rpcStatus(err);
      if (status) {
        rpcFail(status.code, status.message);
      }
      rpcFail(503, '团队服务不可用');
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
