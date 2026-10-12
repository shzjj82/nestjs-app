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
  isStaffRole,
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
   * 回收业务成员身份（粗粒度），来自账户**实时角色**（不读过期会话 roles）：
   * customer=客户 / staff=业务员 / admin=超管。
   */
  identities: Array<{ code: string; label: string }>;
  primaryIdentity: string;
  primaryIdentityLabel: string;
  /** 账户实时角色含业务员 / 超管 */
  isStaff: boolean;
  isAdmin: boolean;
  /** 当前账户绑定的门店（含本店别名）；绑定本身不是身份，须伴随 agent 角色 */
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
    const account = await this.loadAccount(actor.accountId);
    // 身份以 usercenter 实时角色为准，避免绑店赋角色后旧 token 仍显示客户
    const liveRoles = account?.roles?.length ? account.roles : actor.roles;
    const identities = recycleMemberIdentities(liveRoles).map((code) => ({
      code,
      label: RECYCLE_IDENTITY_LABELS[code] ?? code,
    }));
    const primaryIdentity = pickPrimary(identities.map((item) => item.code));
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
      isStaff: isStaffRole(liveRoles),
      isAdmin: isAdmin({ ...actor, roles: liveRoles }),
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
