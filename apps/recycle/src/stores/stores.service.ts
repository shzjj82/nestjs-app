import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import {
  MQTT_PATTERNS,
  optionalString,
  qrImageFilename,
  requiredString,
  rpcFail,
  sniffImageMime,
  unwrapData,
  UploadClient,
  USER_CLIENT,
  WECHAT_CLIENT,
  type UserAccountInfo,
} from '@app/common';
import { lastValueFrom, TimeoutError } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { Repository } from 'typeorm';
import type { Actor } from '../domain';
import {
  RECYCLE_IDENTITY,
  RECYCLE_IDENTITY_LABELS,
  RECYCLE_ROLES,
  requireStaff,
} from '../domain';
import { RecycleStoreEntity, RecycleStoreStaffEntity } from '../entities';
import {
  optionalBool,
  optionalNonNegInt,
  optionalTrim,
  requiredTrim,
} from '../catalog/catalog-write';
import { distanceMeters, isValidLngLat } from './geo';
import { newBindScene, STORE_BIND_PAGE } from './store-scene';

export interface StoreView {
  id: string;
  name: string;
  contact: string;
  phone: string;
  province: string;
  city: string;
  district: string;
  address: string;
  postal: string;
  longitude: number | null;
  latitude: number | null;
  enabled: boolean;
  detail: string;
  createdAt: string;
  updatedAt: string;
}

/** 小程序就近门店：在 StoreView 上附带直线距离 */
export interface NearbyStoreView extends StoreView {
  /** 与用户定位的直线距离（米）；无门店坐标时为 null */
  distanceMeters: number | null;
  /** 距离（公里，保留 1 位小数）；无坐标时为 null */
  distanceKm: number | null;
}

/** 门店已绑成员：账户维度（不含用户手机号） */
export interface StoreStaffView {
  accountId: string;
  /** 账户标识（账密登录名 / 微信 openid 等） */
  accountName: string;
  accountType: string | null;
  /** 门店侧别名 */
  alias: string;
  /** 对外成员身份：staff=业务员 / admin=超管 / customer=客户 */
  role: string;
  roleLabel: string;
  boundAt: string;
}

@Injectable()
export class StoresService {
  private readonly logger = new Logger(StoresService.name);

  constructor(
    @InjectRepository(RecycleStoreEntity)
    private readonly stores: Repository<RecycleStoreEntity>,
    @InjectRepository(RecycleStoreStaffEntity)
    private readonly staff: Repository<RecycleStoreStaffEntity>,
    @Inject(WECHAT_CLIENT) private readonly wechat: ClientProxy,
    @Inject(USER_CLIENT) private readonly users: ClientProxy,
    private readonly upload: UploadClient,
  ) {}

  async list(bizCode: string, includeDisabled = false): Promise<StoreView[]> {
    const rows = await this.stores.find({
      where: includeDisabled ? { bizCode } : { bizCode, enabled: true },
      order: { createdAt: 'ASC' },
    });
    return rows.map((row) => this.toView(row));
  }

  /**
   * 小程序：按用户当前经纬度，对启用中且有坐标的门店按距离升序返回。
   * 无坐标门店排在末尾（distanceMeters=null）。
   *
   * query: longitude, latitude 必填；limit 默认 20 最大 50；maxKm 可选（超过则过滤）
   */
  async nearby(
    bizCode: string,
    payload: Record<string, unknown>,
  ): Promise<{ items: NearbyStoreView[]; total: number }> {
    const longitude = Number(payload.longitude);
    const latitude = Number(payload.latitude);
    if (!isValidLngLat(longitude, latitude)) {
      rpcFail(400, '请传入有效的 longitude / latitude');
    }
    const limit = Math.min(
      50,
      Math.max(1, Number(payload.limit) || 20),
    );
    const maxKmRaw = payload.maxKm;
    const maxKm =
      maxKmRaw === undefined || maxKmRaw === null || maxKmRaw === ''
        ? null
        : Number(maxKmRaw);
    if (maxKm !== null && (!Number.isFinite(maxKm) || maxKm <= 0)) {
      rpcFail(400, 'maxKm 非法');
    }

    const rows = await this.stores.find({
      where: { bizCode, enabled: true },
    });
    const ranked: NearbyStoreView[] = rows.map((row) => {
      const view = this.toView(row);
      if (
        row.longitude == null ||
        row.latitude == null ||
        !isValidLngLat(row.longitude, row.latitude)
      ) {
        return { ...view, distanceMeters: null, distanceKm: null };
      }
      const meters = distanceMeters(
        longitude,
        latitude,
        row.longitude,
        row.latitude,
      );
      return {
        ...view,
        distanceMeters: Math.round(meters),
        distanceKm: Math.round((meters / 1000) * 10) / 10,
      };
    });

    ranked.sort((a, b) => {
      if (a.distanceMeters == null && b.distanceMeters == null) {
        return a.name.localeCompare(b.name, 'zh-CN');
      }
      if (a.distanceMeters == null) return 1;
      if (b.distanceMeters == null) return -1;
      return a.distanceMeters - b.distanceMeters;
    });

    const filtered =
      maxKm == null
        ? ranked
        : ranked.filter(
            (row) =>
              row.distanceKm != null && row.distanceKm <= maxKm,
          );

    return {
      items: filtered.slice(0, limit),
      total: filtered.length,
    };
  }

  async mine(actor: Actor, bizCode: string): Promise<StoreView[]> {
    const bound = await this.boundStores(actor, bizCode);
    return bound.map(({ alias: _alias, ...store }) => store);
  }

  /** 当前账户绑定的门店（含本店别名） */
  async boundStores(
    actor: Actor,
    bizCode: string,
  ): Promise<Array<StoreView & { alias: string }>> {
    if (!actor.accountId) {
      return [];
    }
    const links = await this.staff.find({
      where: { bizCode, accountId: actor.accountId },
      order: { boundAt: 'ASC' },
    });
    if (!links.length) {
      return [];
    }
    const byStore = new Map(links.map((link) => [link.storeId, link]));
    const rows = await this.stores.find({
      where: [...byStore.keys()].map((id) => ({ id, bizCode })),
      order: { createdAt: 'ASC' },
    });
    return rows
      .filter((row) => row.enabled)
      .map((row) => ({
        ...this.toView(row),
        alias: byStore.get(row.id)?.alias ?? '',
      }));
  }

  async detail(bizCode: string, id: string): Promise<StoreView> {
    return this.toView(await this.requireStore(bizCode, id));
  }

  async create(actor: Actor, bizCode: string, payload: Record<string, unknown>) {
    requireStaff(actor, '创建门店');
    const saved = await this.stores.save(
      this.stores.create({
        bizCode,
        ...this.readFields(payload, true),
        bindScene: newBindScene(),
        enabled: optionalBool(payload.enabled) ?? true,
      }),
    );
    return this.toView(saved);
  }

  async update(actor: Actor, bizCode: string, payload: Record<string, unknown>) {
    requireStaff(actor, '更新门店');
    const row = await this.requireStore(
      bizCode,
      requiredString(payload.id, 'id'),
    );
    Object.assign(row, this.readFields(payload, false));
    const enabled = optionalBool(payload.enabled);
    if (enabled !== undefined) {
      row.enabled = enabled;
    }
    return this.toView(await this.stores.save(row));
  }

  async disable(actor: Actor, bizCode: string, id: string) {
    requireStaff(actor, '下架门店');
    const row = await this.requireStore(bizCode, id);
    row.enabled = false;
    await this.stores.save(row);
    return { id: row.id, enabled: false };
  }

  async listStaff(actor: Actor, bizCode: string, storeId: string) {
    requireStaff(actor, '查看门店账号');
    await this.requireStore(bizCode, storeId);
    const rows = await this.staff.find({
      where: { storeId, bizCode },
      order: { boundAt: 'ASC' },
    });
    const accounts = await this.loadAccounts(rows.map((row) => row.accountId));
    return rows.map((row) => this.toStaffView(row, accounts.get(row.accountId)));
  }

  async updateStaff(
    actor: Actor,
    bizCode: string,
    storeId: string,
    accountId: string,
    payload: Record<string, unknown>,
  ) {
    requireStaff(actor, '更新门店账号');
    await this.requireStore(bizCode, storeId);
    const row = await this.staff.findOne({
      where: { storeId, accountId, bizCode },
    });
    if (!row) {
      rpcFail(404, '未绑定该账号');
    }
    if (payload.alias !== undefined) {
      row.alias = optionalTrim(payload.alias, 64, 'alias') ?? '';
    }
    const saved = await this.staff.save(row);
    const [account] = await this.loadAccounts([saved.accountId]).then((map) => [
      map.get(saved.accountId),
    ]);
    return this.toStaffView(saved, account);
  }

  async unbind(
    actor: Actor,
    bizCode: string,
    storeId: string,
    accountId: string,
  ) {
    requireStaff(actor, '解除门店绑定');
    await this.requireStore(bizCode, storeId);
    const row = await this.staff.findOne({
      where: { storeId, accountId, bizCode },
    });
    if (!row) {
      rpcFail(404, '未绑定该账号');
    }
    await this.staff.remove(row);
    return { storeId, accountId };
  }

  async bind(actor: Actor, bizCode: string, scene: string) {
    const token = requiredString(scene, 'scene');
    if (!actor.accountId) {
      rpcFail(400, '当前会话没有业务账号，无法绑定门店');
    }
    const store = await this.stores.findOne({
      where: { bindScene: token, bizCode },
    });
    if (!store || !store.enabled) {
      rpcFail(404, '门店码无效或门店已停用');
    }
    const exists = await this.staff.findOne({
      where: { storeId: store.id, accountId: actor.accountId },
    });
    if (!exists) {
      await this.staff.save(
        this.staff.create({
          bizCode,
          storeId: store.id,
          accountId: actor.accountId,
          userId: actor.userId,
          alias: '',
        }),
      );
    }
    // 绑定后默认业务员（只增不删；业务未建 agent 角色时跳过）
    await this.ensureAgentRole(actor.accountId, bizCode);
    return this.toView(store);
  }

  async qrcode(actor: Actor, bizCode: string, payload: Record<string, unknown>) {
    requireStaff(actor, '生成门店绑定码');
    const store = await this.requireStore(
      bizCode,
      requiredString(payload.id, 'id'),
    );
    if (optionalBool(payload.rotate) === true) {
      store.bindScene = newBindScene();
      await this.stores.save(store);
    }
    const appId =
      optionalString(payload.appId) ?? actor.wechatAppId ?? undefined;
    if (!appId) {
      rpcFail(400, '缺少小程序 appId');
    }
    const page = optionalString(payload.page) ?? STORE_BIND_PAGE;
    const envVersion = optionalString(payload.envVersion) ?? 'release';
    const width = optionalNonNegInt(payload.width, 'width') ?? 280;
    try {
      const raw = await lastValueFrom(
        this.wechat
          .send(MQTT_PATTERNS.WECHAT_QRCODE, {
            appId,
            scene: store.bindScene,
            page,
            checkPath: false,
            envVersion,
            width,
          })
          .pipe(timeout(15000)),
      );
      const file = unwrapData<{
        mime: string;
        filename: string;
        base64: string;
      }>(raw);
      if (!file?.base64) {
        rpcFail(502, '未返回小程序码');
      }
      const mime = sniffImageMime(file.base64, file.mime);
      const filename = qrImageFilename(
        `store-bind-${store.id}`,
        mime,
        file.filename,
      );
      const stored = await this.upload.put({
        bizCode,
        filename,
        contentType: mime,
        base64: file.base64,
        prefix: 'store-bind-qr',
      });
      return {
        storeId: store.id,
        scene: store.bindScene,
        page,
        mime,
        filename,
        url: stored.url,
        key: stored.key,
      };
    } catch (err) {
      if (err instanceof TimeoutError) {
        rpcFail(504, '微信服务超时');
      }
      const payloadErr = err as { status?: number; message?: string };
      rpcFail(
        payloadErr?.status ?? 502,
        payloadErr?.message ?? '生成小程序码失败',
      );
    }
  }

  private readFields(payload: Record<string, unknown>, creating: boolean) {
    const name = creating
      ? requiredTrim(payload.name, 64, 'name')
      : optionalTrim(payload.name, 64, 'name');
    const coord = (value: unknown, field: string): number | null | undefined => {
      if (value === undefined) {
        return undefined;
      }
      if (value === null || value === '') {
        return null;
      }
      const n = Number(value);
      if (!Number.isFinite(n)) {
        rpcFail(400, `${field} 非法`);
      }
      return n;
    };
    const fields: Partial<RecycleStoreEntity> = {};
    if (name !== undefined) fields.name = name;
    if (creating || payload.contact !== undefined) {
      fields.contact = optionalTrim(payload.contact, 32, 'contact') ?? '';
    }
    if (creating || payload.phone !== undefined) {
      fields.phone = optionalTrim(payload.phone, 32, 'phone') ?? '';
    }
    if (creating || payload.province !== undefined) {
      fields.province = optionalTrim(payload.province, 32, 'province') ?? '';
    }
    if (creating || payload.city !== undefined) {
      fields.city = optionalTrim(payload.city, 32, 'city') ?? '';
    }
    if (creating || payload.district !== undefined) {
      fields.district = optionalTrim(payload.district, 32, 'district') ?? '';
    }
    if (creating || payload.address !== undefined) {
      fields.address = requiredTrim(payload.address, 255, 'address');
    }
    if (creating || payload.postal !== undefined) {
      fields.postal = optionalTrim(payload.postal, 16, 'postal') ?? '';
    }
    const longitude = coord(payload.longitude, 'longitude');
    if (longitude !== undefined) fields.longitude = longitude;
    const latitude = coord(payload.latitude, 'latitude');
    if (latitude !== undefined) fields.latitude = latitude;
    return fields;
  }

  private toView(row: RecycleStoreEntity): StoreView {
    const detail = [row.province, row.city, row.district, row.address]
      .filter(Boolean)
      .join('');
    return {
      id: row.id,
      name: row.name,
      contact: row.contact,
      phone: row.phone,
      province: row.province,
      city: row.city,
      district: row.district,
      address: row.address,
      postal: row.postal,
      longitude: row.longitude,
      latitude: row.latitude,
      enabled: row.enabled,
      detail,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async requireStore(bizCode: string, id: string) {
    const row = await this.stores.findOne({ where: { id, bizCode } });
    if (!row) {
      rpcFail(404, '门店不存在');
    }
    return row;
  }

  private toStaffView(
    row: RecycleStoreStaffEntity,
    account?: UserAccountInfo,
  ): StoreStaffView {
    const roles = account?.roles ?? [];
    const role = roles.includes(RECYCLE_ROLES.ADMIN)
      ? RECYCLE_IDENTITY.ADMIN
      : RECYCLE_IDENTITY.STAFF;
    return {
      accountId: row.accountId,
      accountName: account?.identifier ?? row.accountId,
      accountType: account?.type ?? null,
      alias: row.alias ?? '',
      role,
      roleLabel: RECYCLE_IDENTITY_LABELS[role] ?? '业务员',
      boundAt: row.boundAt.toISOString(),
    };
  }

  private async loadAccounts(
    accountIds: string[],
  ): Promise<Map<string, UserAccountInfo>> {
    const ids = [...new Set(accountIds.filter(Boolean))];
    const map = new Map<string, UserAccountInfo>();
    if (!ids.length) {
      return map;
    }
    try {
      const raw = await lastValueFrom(
        this.users
          .send(MQTT_PATTERNS.ACCOUNT_FIND_MANY, { ids })
          .pipe(timeout(8000)),
      );
      const list = unwrapData<UserAccountInfo[]>(raw);
      for (const item of Array.isArray(list) ? list : []) {
        if (item?.id) {
          map.set(item.id, item);
        }
      }
    } catch (err) {
      this.logger.warn(
        `拉取门店绑定账户失败：${err instanceof Error ? err.message : String(err)}`,
      );
    }
    return map;
  }

  private async ensureAgentRole(accountId: string, bizCode: string) {
    try {
      const raw = await lastValueFrom(
        this.users
          .send(MQTT_PATTERNS.ACCOUNT_ENSURE_ROLES, {
            accountId,
            bizCode,
            codes: [RECYCLE_ROLES.AGENT],
          })
          .pipe(timeout(8000)),
      );
      const result = unwrapData<{ added?: string[]; missing?: string[] }>(raw);
      if (result?.missing?.length) {
        this.logger.warn(
          `业务 ${bizCode} 未配置角色 ${result.missing.join(',')}，绑定账号 ${accountId} 未自动赋业务员`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `绑定后赋业务员失败（${accountId}）：${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
