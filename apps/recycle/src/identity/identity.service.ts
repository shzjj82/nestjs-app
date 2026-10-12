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
  isAdmin,
  isCustomerOnly,
  RECYCLE_IDENTITY,
  RECYCLE_IDENTITY_LABELS,
  recycleMemberIdentities,
} from '../domain';
import { StoresService } from '../stores/stores.service';

export interface RecycleIdentityView {
  userId: string;
  accountId: string | null;
  nickname: string | null;
  bizCode: string;
  wechatAppId: string | null;
  /** 当前会话账户（标识 / 类型；不含手机号） */
  account: {
    id: string;
    identifier: string;
    type: string;
  } | null;
  /**
   * 回收业务成员身份（粗粒度）：
   * customer=客户 / staff=业务员 / admin=超管。
   * 一人可同时有客户+业务员，前端用不同接口拉数据。
   */
  identities: Array<{ code: string; label: string }>;
  primaryIdentity: string;
  primaryIdentityLabel: string;
  /** 非纯客户：可走业务员接口 */
  isStaff: boolean;
  isAdmin: boolean;
  /** 当前账户绑定的门店（含本店别名） */
  stores: Array<{
    id: string;
    name: string;
    alias: string;
    enabled: boolean;
  }>;
}

const PRIMARY_PRIORITY = [
  RECYCLE_IDENTITY.ADMIN,
  RECYCLE_IDENTITY.STAFF,
  RECYCLE_IDENTITY.CUSTOMER,
] as const;

@Injectable()
export class IdentityService {
  private readonly logger = new Logger(IdentityService.name);

  constructor(
    private readonly stores: StoresService,
    @Inject(USER_CLIENT) private readonly users: ClientProxy,
  ) {}

  async me(actor: Actor, bizCode: string): Promise<RecycleIdentityView> {
    const identities = recycleMemberIdentities(actor.roles).map((code) => ({
      code,
      label: RECYCLE_IDENTITY_LABELS[code] ?? code,
    }));
    const primaryIdentity = pickPrimary(identities.map((item) => item.code));
    const account = await this.loadAccount(actor.accountId);
    const stores = await this.stores.boundStores(actor, bizCode);

    return {
      userId: actor.userId,
      accountId: actor.accountId,
      nickname: actor.nickname,
      bizCode,
      wechatAppId: actor.wechatAppId,
      account: account
        ? {
            id: account.id,
            identifier: account.identifier,
            type: account.type,
          }
        : actor.accountId
          ? {
              id: actor.accountId,
              identifier: actor.accountId,
              type: 'unknown',
            }
          : null,
      identities,
      primaryIdentity,
      primaryIdentityLabel:
        RECYCLE_IDENTITY_LABELS[primaryIdentity] ?? primaryIdentity,
      isStaff: !isCustomerOnly(actor),
      isAdmin: isAdmin(actor),
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

function pickPrimary(codes: string[]): string {
  for (const code of PRIMARY_PRIORITY) {
    if (codes.includes(code)) {
      return code;
    }
  }
  return codes[0] ?? RECYCLE_IDENTITY.CUSTOMER;
}
