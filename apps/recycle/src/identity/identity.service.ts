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
import {
  RECYCLE_IDENTITY,
  RECYCLE_IDENTITY_LABELS,
  recycleMemberIdentities,
} from '../domain';
import { StoresService } from '../stores/stores.service';

/**
 * GET /recycle/me 精简视图。
 * 客户为默认身份，不单独返回；identities 只列额外身份（业务员 / 超管）。
 */
export interface RecycleIdentityView {
  userId: string;
  nickname: string | null;
  identities: Array<{ code: string; label: string }>;
  stores: Array<{
    id: string;
    name: string;
    alias: string;
    enabled: boolean;
  }>;
}

@Injectable()
export class IdentityService {
  private readonly logger = new Logger(IdentityService.name);

  constructor(
    private readonly stores: StoresService,
    @Inject(USER_CLIENT) private readonly users: ClientProxy,
  ) {}

  async me(actor: Actor, bizCode: string): Promise<RecycleIdentityView> {
    const account = await this.loadAccount(actor.accountId);
    // 身份以 usercenter 实时角色为准，避免绑店赋角色后旧 token 仍显示客户
    const liveRoles = account?.roles?.length ? account.roles : actor.roles;
    const identities = recycleMemberIdentities(liveRoles)
      .filter((code) => code !== RECYCLE_IDENTITY.CUSTOMER)
      .map((code) => ({
        code,
        label: RECYCLE_IDENTITY_LABELS[code] ?? code,
      }));
    const stores = await this.stores.boundStores(actor, bizCode);

    return {
      userId: actor.userId,
      nickname: actor.nickname,
      identities,
      stores: stores.map((store) => ({
        id: store.id,
        name: store.name,
        alias: store.alias,
        enabled: store.enabled,
      })),
    };
  }

  private async loadAccount(
    accountId: string | null,
  ): Promise<UserAccountInfo | null> {
    if (!accountId) {
      return null;
    }
    try {
      const raw = await lastValueFrom(
        this.users
          .send(MQTT_PATTERNS.ACCOUNT_FIND_MANY, { ids: [accountId] })
          .pipe(timeout(8000)),
      );
      const list = unwrapData<UserAccountInfo[]>(raw);
      return Array.isArray(list) ? (list[0] ?? null) : null;
    } catch (err) {
      this.logger.warn(
        `拉取当前账户失败：${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }
}
