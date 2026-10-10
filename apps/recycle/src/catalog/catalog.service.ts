import { Injectable } from '@nestjs/common';
import { optionalString, rpcFail } from '@app/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CartridgeType, isCartridgeType } from '../domain';
import {
  RecycleBrandEntity,
  RecycleCartridgeTypeEntity,
  RecycleModelEntity,
} from '../entities';

/** 耗材类型行（前端 CartridgeTypeRow） */
export interface CatalogTypeRow {
  key: CartridgeType;
  label: string;
  desc: string;
  color: string;
}

/** 品牌行：一行 = 一个「品牌 × 类型」组合（前端 BrandRow） */
export interface CatalogBrandRow {
  brand: string;
  logo: string;
  type: CartridgeType;
}

/** 型号行：一行 = 一个型号，带品牌与类型供前端过滤（前端 ModelRow） */
export interface CatalogModelRow {
  name: string;
  spec: string;
  fits: string;
  chip: boolean;
  /** 回收单价（分） */
  price: number;
  brand: string;
  type: CartridgeType;
}

/** 估价行：服务端定价后回填的明细（前端 OrderItemView） */
export interface QuoteLine {
  cartridgeType: CartridgeType;
  brand: string;
  model: string;
  spec: string;
  chip: boolean;
  quantity: number;
  /** 单支回收价（分），取自目录，不接受客户端值 */
  price: number;
}

export interface QuoteResult {
  items: QuoteLine[];
  totalQuantity: number;
  /** 整单预估回收价（分） */
  estimatePrice: number;
}

/** 目录报价时需要的入参（下单复用同一套校验） */
export interface QuoteRequestItem {
  cartridgeType: CartridgeType;
  brand: string;
  model: string;
  quantity: number;
}

const MAX_ITEMS = 50;
const MAX_QUANTITY = 999;

/**
 * 回收目录（参考数据）+ 服务端定价。
 *
 * 职责边界：
 *  - 目录是**只读字典**，谁都能读，不做 bizCode 隔离（平台级价目表）。
 *  - 定价**只认本表**：客户端只申报「是什么、多少支」，单价一律服务端回填。
 *    之前下单直接信任客户端传的 price，等于把价目表交给前端，这里堵上。
 *  - 不依赖 orders / approvals，反向被 orders 单向依赖（查价），无环。
 */
@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(RecycleCartridgeTypeEntity)
    private readonly typeRepo: Repository<RecycleCartridgeTypeEntity>,
    @InjectRepository(RecycleBrandEntity)
    private readonly brandRepo: Repository<RecycleBrandEntity>,
    @InjectRepository(RecycleModelEntity)
    private readonly modelRepo: Repository<RecycleModelEntity>,
  ) {}

  /** GET /recycle/cartridges/types */
  async types(): Promise<CatalogTypeRow[]> {
    const rows = await this.typeRepo.find({
      where: { enabled: true },
      order: { sort: 'ASC' },
    });
    return rows.map((row) => ({
      key: row.key,
      label: row.label,
      desc: row.desc,
      color: row.color,
    }));
  }

  /** GET /recycle/cartridges/brands?type= */
  async brands(type?: string): Promise<CatalogBrandRow[]> {
    const rows = await this.brandRepo.find({
      where: { enabled: true, ...(this.typeOf(type) ?? {}) },
      order: { sort: 'ASC' },
    });
    return rows.map((row) => ({
      brand: row.brand,
      logo: row.logo,
      type: row.type,
    }));
  }

  /** GET /recycle/cartridges/models?type=&brand= */
  async models(type?: string, brand?: string): Promise<CatalogModelRow[]> {
    const where: Record<string, unknown> = { enabled: true };
    const parsed = this.typeOf(type);
    if (parsed) where.type = parsed.type;
    if (brand && brand.trim()) where.brand = brand.trim();
    const rows = await this.modelRepo.find({
      where,
      order: { sort: 'ASC' },
    });
    return rows.map((row) => ({
      name: row.name,
      spec: row.spec,
      fits: row.fits,
      chip: row.chip,
      price: row.price,
      brand: row.brand,
      type: row.type,
    }));
  }

  /** 一次性拿三张扁平表（省两次往返） */
  async all(): Promise<{
    types: CatalogTypeRow[];
    brands: CatalogBrandRow[];
    models: CatalogModelRow[];
  }> {
    const [types, brands, models] = await Promise.all([
      this.types(),
      this.brands(),
      this.models(),
    ]);
    return { types, brands, models };
  }

  /** POST /recycle/quotes —— 服务端定价，返回可直接下单的明细 */
  async quote(raw: unknown): Promise<QuoteResult> {
    const items = this.readQuoteItems(raw);
    const lines = await this.priceItems(items);
    return {
      items: lines,
      totalQuantity: lines.reduce((sum, line) => sum + line.quantity, 0),
      estimatePrice: lines.reduce(
        (sum, line) => sum + line.price * line.quantity,
        0,
      ),
    };
  }

  /**
   * 按目录给明细定价（下单复用）。
   * 型号不在目录里直接 400 —— 宁可拒绝，也不要让客户端带价进库。
   */
  async priceItems(items: QuoteRequestItem[]): Promise<QuoteLine[]> {
    const rows = await Promise.all(
      items.map((item) =>
        this.modelRepo.findOne({
          where: {
            type: item.cartridgeType,
            brand: item.brand,
            name: item.model,
            enabled: true,
          },
        }),
      ),
    );

    return items.map((item, index) => {
      const row = rows[index];
      if (!row) {
        rpcFail(
          400,
          `型号「${item.brand} / ${item.model}」不在回收目录中，请先获取目录`,
        );
      }
      return {
        cartridgeType: item.cartridgeType,
        brand: item.brand,
        model: item.model,
        spec: row.spec,
        chip: row.chip,
        quantity: item.quantity,
        price: row.price,
      };
    });
  }

  /** 解析客户端上报的明细：只认 cartridgeType / brand / model / quantity */
  readQuoteItems(raw: unknown): QuoteRequestItem[] {
    if (!Array.isArray(raw) || raw.length === 0) {
      rpcFail(400, '请先添加要回收的耗材');
    }
    if (raw.length > MAX_ITEMS) {
      rpcFail(400, `单次最多 ${MAX_ITEMS} 个型号`);
    }
    return (raw as unknown[]).map((entry) => {
      const row = (entry ?? {}) as Record<string, unknown>;
      const cartridgeType = row.cartridgeType ?? row.type;
      if (!isCartridgeType(cartridgeType)) {
        rpcFail(400, 'cartridgeType 只能是 ink 或 toner');
      }
      const brand = optionalString(row.brand);
      const model = optionalString(row.model);
      if (!brand) rpcFail(400, 'brand 必填');
      if (!model) rpcFail(400, 'model 必填');
      const quantity = Number(row.quantity);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        rpcFail(400, 'quantity 必须为正整数');
      }
      if (quantity > MAX_QUANTITY) {
        rpcFail(400, `单个型号数量不能超过 ${MAX_QUANTITY}`);
      }
      return { cartridgeType, brand, model, quantity };
    });
  }

  // ---------------------------------------------------------------- 内部

  /** query 里的 type 是可选的，非法值直接拒绝而不是静默忽略 */
  private typeOf(value?: string): { type: CartridgeType } | undefined {
    const raw = optionalString(value);
    if (!raw) return undefined;
    if (!isCartridgeType(raw)) {
      rpcFail(400, 'type 只能是 ink 或 toner');
    }
    return { type: raw };
  }
}
