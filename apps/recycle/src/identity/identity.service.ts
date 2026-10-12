import { Injectable } from '@nestjs/common';
import type { Actor } from '../domain';
import {
  RECYCLE_IDENTITY,
  RECYCLE_IDENTITY_LABELS,
  recycleMemberIdentities,
} from '../domain';
import { LiveRolesService } from './live-roles.service';
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
  constructor(
    private readonly stores: StoresService,
    private readonly liveRoles: LiveRolesService,
  ) {}

  async me(actor: Actor, bizCode: string): Promise<RecycleIdentityView> {
    const live = await this.liveRoles.hydrate(actor);
    const identities = recycleMemberIdentities(live.roles)
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
}
