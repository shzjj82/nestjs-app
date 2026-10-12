import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  MQTT_PATTERNS,
  unwrapData,
  USER_CLIENT,
  type UserAccountInfo,
} from '@app/common';
import { lastValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';
import type { Actor } from '../domain';
import { requireStaff } from '../domain';

/**
 * JWT 角色可能滞后（绑店赋 agent 后旧 token 仍是客户）。
 * 写路径按 usercenter 当前账户角色覆盖后再做业务员校验。
 */
@Injectable()
export class LiveRolesService {
  private readonly logger = new Logger(LiveRolesService.name);

  constructor(@Inject(USER_CLIENT) private readonly users: ClientProxy) {}

  async hydrate(actor: Actor): Promise<Actor> {
    if (!actor.accountId) {
      return actor;
    }
    try {
      const raw = await lastValueFrom(
        this.users
          .send(MQTT_PATTERNS.ACCOUNT_FIND_MANY, { ids: [actor.accountId] })
          .pipe(timeout(8000)),
      );
      const list = unwrapData<UserAccountInfo[]>(raw);
      const account = Array.isArray(list) ? list[0] : null;
      if (!account?.roles?.length) {
        return actor;
      }
      return { ...actor, roles: account.roles };
    } catch (err) {
      this.logger.warn(
        `拉取账户角色失败，沿用会话角色：${err instanceof Error ? err.message : String(err)}`,
      );
      return actor;
    }
  }

  async requireStaff(actor: Actor, action: string): Promise<Actor> {
    const live = await this.hydrate(actor);
    requireStaff(live, action);
    return live;
  }
}
