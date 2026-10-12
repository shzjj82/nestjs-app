import { Inject, Injectable } from '@nestjs/common';
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
  WECHAT_CLIENT,
} from '@app/common';
import { lastValueFrom, TimeoutError } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { Repository } from 'typeorm';
import type { Actor } from '../domain';
import { requireStaff } from '../domain';
import { RecycleStoreEntity, RecycleStoreStaffEntity } from '../entities';
import {
  optionalBool,
  optionalNonNegInt,
  optionalTrim,
  requiredTrim,
} from '../catalog/catalog-write';
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

export interface StoreStaffView {
  accountId: string;
  userId: string;
  boundAt: string;
}

@Injectable()
export class StoresService {
  constructor(
    @InjectRepository(RecycleStoreEntity)
    private readonly stores: Repository<RecycleStoreEntity>,
    @InjectRepository(RecycleStoreStaffEntity)
    private readonly staff: Repository<RecycleStoreStaffEntity>,
    @Inject(WECHAT_CLIENT) private readonly wechat: ClientProxy,
    private readonly upload: UploadClient,
  ) {}

  async list(bizCode: string, includeDisabled = false): Promise<StoreView[]> {
    const rows = await this.stores.find({
      where: includeDisabled ? { bizCode } : { bizCode, enabled: true },
      order: { createdAt: 'ASC' },
    });
    return rows.map((row) => this.toView(row));
  }

  async mine(actor: Actor, bizCode: string): Promise<StoreView[]> {
    if (!actor.accountId) {
      return [];
    }
    const links = await this.staff.find({
      where: { bizCode, accountId: actor.accountId },
    });
    if (!links.length) {
      return [];
    }
    const ids = links.map((link) => link.storeId);
    const rows = await this.stores.find({
      where: ids.map((id) => ({ id, bizCode })),
      order: { createdAt: 'ASC' },
    });
    return rows.filter((row) => row.enabled).map((row) => this.toView(row));
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
    return rows.map(
      (row): StoreStaffView => ({
        accountId: row.accountId,
        userId: row.userId,
        boundAt: row.boundAt.toISOString(),
      }),
    );
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
        }),
      );
    }
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
}
