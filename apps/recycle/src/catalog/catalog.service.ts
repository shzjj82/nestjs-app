import { Injectable } from '@nestjs/common';
import { rpcFail } from '@app/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  RecycleBrandEntity,
  RecycleCartridgeTypeEntity,
  RecycleModelEntity,
} from '../entities';
import {
  optionalId,
  readQuoteItems,
  requireId,
  type QuoteRequestItem,
} from './catalog-items';
import {
  optionalBool,
  optionalNonNegInt,
  optionalTrim,
  parseNonNegInt,
  parseTypeKey,
  requiredTrim,
} from './catalog-write';

export type { QuoteRequestItem } from './catalog-items';

export interface CatalogTypeRow {
  id: string;
  key: string;
  label: string;
  desc: string;
  color: string;
}

export interface CatalogBrandRow {
  id: string;
  typeId: string;
  brand: string;
  logo: string;
}

export interface CatalogModelRow {
  id: string;
  typeId: string;
  brandId: string;
  name: string;
  spec: string;
  fits: string;
  chip: boolean;
  price: number;
}

export interface QuoteLine {
  typeId: string;
  brandId: string;
  modelId: string;
  cartridgeType: string;
  brand: string;
  model: string;
  spec: string;
  chip: boolean;
  quantity: number;
  price: number;
}

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

  async types(): Promise<CatalogTypeRow[]> {
    const rows = await this.typeRepo.find({
      where: { enabled: true },
      order: { sort: 'ASC' },
    });
    return rows.map((row) => ({
      id: row.id,
      key: row.key,
      label: row.label,
      desc: row.desc,
      color: row.color,
    }));
  }

  async brands(typeId?: string): Promise<CatalogBrandRow[]> {
    const rows = await this.brandRepo.find({
      where: { enabled: true, ...(this.typeIdOf(typeId) ?? {}) },
      order: { sort: 'ASC' },
    });
    return rows.map((row) => ({
      id: row.id,
      typeId: row.typeId,
      brand: row.brand,
      logo: row.logo,
    }));
  }

  async models(typeId?: string, brandId?: string): Promise<CatalogModelRow[]> {
    const where: Record<string, unknown> = { enabled: true };
    const parsedTypeId = optionalId(typeId, 'typeId');
    if (parsedTypeId) where.typeId = parsedTypeId;
    const parsedBrandId = optionalId(brandId, 'brandId');
    if (parsedBrandId) where.brandId = parsedBrandId;
    const rows = await this.modelRepo.find({
      where,
      order: { sort: 'ASC' },
    });
    return rows.map((row) => ({
      id: row.id,
      typeId: row.typeId,
      brandId: row.brandId,
      name: row.name,
      spec: row.spec,
      fits: row.fits,
      chip: row.chip,
      price: row.price,
    }));
  }

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

  async priceItems(items: QuoteRequestItem[]): Promise<QuoteLine[]> {
    const rows = await Promise.all(
      items.map((item) =>
        this.modelRepo.findOne({
          where: { id: item.modelId, enabled: true },
          relations: { typeRef: true, brandRef: true },
        }),
      ),
    );

    return items.map((item, index) => {
      const row = rows[index];
      if (!row || !row.typeRef || !row.brandRef) {
        rpcFail(400, '型号不在回收目录中，请先获取目录');
      }
      if (item.typeId && item.typeId !== row.typeId) {
        rpcFail(400, 'typeId 与型号不匹配');
      }
      if (item.brandId && item.brandId !== row.brandId) {
        rpcFail(400, 'brandId 与型号不匹配');
      }
      return {
        typeId: row.typeId,
        brandId: row.brandId,
        modelId: row.id,
        cartridgeType: row.typeRef.key,
        brand: row.brandRef.brand,
        model: row.name,
        spec: row.spec,
        chip: row.chip,
        quantity: item.quantity,
        price: row.price,
      };
    });
  }

  readQuoteItems(raw: unknown): QuoteRequestItem[] {
    return readQuoteItems(raw);
  }

  async createType(payload: Record<string, unknown>): Promise<CatalogTypeRow> {
    const key = parseTypeKey(payload.key);
    if (await this.typeRepo.findOne({ where: { key } })) {
      rpcFail(409, `类型 ${key} 已存在`);
    }
    const saved = await this.typeRepo.save(
      this.typeRepo.create({
        key,
        label: requiredTrim(payload.label, 32, 'label'),
        desc: optionalTrim(payload.desc ?? payload.description, 128, 'desc') ?? '',
        color: optionalTrim(payload.color, 16, 'color') ?? '#3b82f6',
        sort: optionalNonNegInt(payload.sort, 'sort') ?? 0,
        enabled: optionalBool(payload.enabled) ?? true,
      }),
    );
    return this.toType(saved);
  }

  async updateType(payload: Record<string, unknown>): Promise<CatalogTypeRow> {
    const row = await this.requireType(requireId(payload.id, 'id'));
    if (payload.key !== undefined) {
      const key = parseTypeKey(payload.key);
      const taken = await this.typeRepo.findOne({ where: { key } });
      if (taken && taken.id !== row.id) {
        rpcFail(409, `类型 ${key} 已存在`);
      }
      row.key = key;
    }
    if (payload.label !== undefined) {
      row.label = requiredTrim(payload.label, 32, 'label');
    }
    if (payload.desc !== undefined || payload.description !== undefined) {
      row.desc =
        optionalTrim(payload.desc ?? payload.description, 128, 'desc') ?? '';
    }
    if (payload.color !== undefined) {
      row.color = optionalTrim(payload.color, 16, 'color') ?? row.color;
    }
    if (payload.sort !== undefined) {
      row.sort = parseNonNegInt(payload.sort, 'sort');
    }
    const enabled = optionalBool(payload.enabled);
    if (enabled !== undefined) {
      row.enabled = enabled;
    }
    return this.toType(await this.typeRepo.save(row));
  }

  async disableType(id: string): Promise<{ id: string; enabled: boolean }> {
    const row = await this.requireType(id);
    row.enabled = false;
    await this.typeRepo.save(row);
    return { id: row.id, enabled: false };
  }

  async createBrand(payload: Record<string, unknown>): Promise<CatalogBrandRow> {
    const type = await this.requireType(requireId(payload.typeId, 'typeId'));
    const brand = requiredTrim(payload.brand, 64, 'brand');
    if (await this.brandRepo.findOne({ where: { typeId: type.id, brand } })) {
      rpcFail(409, `该类型下已有品牌 ${brand}`);
    }
    const saved = await this.brandRepo.save(
      this.brandRepo.create({
        typeId: type.id,
        brand,
        logo: optionalTrim(payload.logo, 512, 'logo') ?? '',
        sort: optionalNonNegInt(payload.sort, 'sort') ?? 0,
        enabled: optionalBool(payload.enabled) ?? true,
      }),
    );
    return this.toBrand(saved);
  }

  async updateBrand(payload: Record<string, unknown>): Promise<CatalogBrandRow> {
    const row = await this.requireBrand(requireId(payload.id, 'id'));
    if (payload.typeId !== undefined) {
      const type = await this.requireType(requireId(payload.typeId, 'typeId'));
      row.typeId = type.id;
    }
    if (payload.brand !== undefined) {
      row.brand = requiredTrim(payload.brand, 64, 'brand');
    }
    const clash = await this.brandRepo.findOne({
      where: { typeId: row.typeId, brand: row.brand },
    });
    if (clash && clash.id !== row.id) {
      rpcFail(409, `该类型下已有品牌 ${row.brand}`);
    }
    if (payload.logo !== undefined) {
      row.logo = optionalTrim(payload.logo, 512, 'logo') ?? '';
    }
    if (payload.sort !== undefined) {
      row.sort = parseNonNegInt(payload.sort, 'sort');
    }
    const enabled = optionalBool(payload.enabled);
    if (enabled !== undefined) {
      row.enabled = enabled;
    }
    return this.toBrand(await this.brandRepo.save(row));
  }

  async disableBrand(id: string): Promise<{ id: string; enabled: boolean }> {
    const row = await this.requireBrand(id);
    row.enabled = false;
    await this.brandRepo.save(row);
    return { id: row.id, enabled: false };
  }

  async createModel(payload: Record<string, unknown>): Promise<CatalogModelRow> {
    const type = await this.requireType(requireId(payload.typeId, 'typeId'));
    const brand = await this.requireBrand(requireId(payload.brandId, 'brandId'));
    if (brand.typeId !== type.id) {
      rpcFail(400, 'brandId 不属于该 typeId');
    }
    const name = requiredTrim(payload.name, 64, 'name');
    if (await this.modelRepo.findOne({ where: { brandId: brand.id, name } })) {
      rpcFail(409, `该品牌下已有型号 ${name}`);
    }
    const saved = await this.modelRepo.save(
      this.modelRepo.create({
        typeId: type.id,
        brandId: brand.id,
        name,
        spec: optionalTrim(payload.spec, 64, 'spec') ?? '',
        fits: optionalTrim(payload.fits, 255, 'fits') ?? '',
        chip: optionalBool(payload.chip) ?? false,
        price: parseNonNegInt(payload.price, 'price'),
        sort: optionalNonNegInt(payload.sort, 'sort') ?? 0,
        enabled: optionalBool(payload.enabled) ?? true,
      }),
    );
    return this.toModel(saved);
  }

  async updateModel(payload: Record<string, unknown>): Promise<CatalogModelRow> {
    const row = await this.requireModel(requireId(payload.id, 'id'));
    if (payload.typeId !== undefined) {
      const type = await this.requireType(requireId(payload.typeId, 'typeId'));
      row.typeId = type.id;
    }
    if (payload.brandId !== undefined) {
      const brand = await this.requireBrand(requireId(payload.brandId, 'brandId'));
      row.brandId = brand.id;
    }
    const brand = await this.requireBrand(row.brandId);
    if (brand.typeId !== row.typeId) {
      rpcFail(400, 'brandId 不属于该 typeId');
    }
    if (payload.name !== undefined) {
      row.name = requiredTrim(payload.name, 64, 'name');
    }
    const clash = await this.modelRepo.findOne({
      where: { brandId: row.brandId, name: row.name },
    });
    if (clash && clash.id !== row.id) {
      rpcFail(409, `该品牌下已有型号 ${row.name}`);
    }
    if (payload.spec !== undefined) {
      row.spec = optionalTrim(payload.spec, 64, 'spec') ?? '';
    }
    if (payload.fits !== undefined) {
      row.fits = optionalTrim(payload.fits, 255, 'fits') ?? '';
    }
    const chip = optionalBool(payload.chip);
    if (chip !== undefined) {
      row.chip = chip;
    }
    if (payload.price !== undefined) {
      row.price = parseNonNegInt(payload.price, 'price');
    }
    if (payload.sort !== undefined) {
      row.sort = parseNonNegInt(payload.sort, 'sort');
    }
    const enabled = optionalBool(payload.enabled);
    if (enabled !== undefined) {
      row.enabled = enabled;
    }
    return this.toModel(await this.modelRepo.save(row));
  }

  async disableModel(id: string): Promise<{ id: string; enabled: boolean }> {
    const row = await this.requireModel(id);
    row.enabled = false;
    await this.modelRepo.save(row);
    return { id: row.id, enabled: false };
  }

  private toType(row: RecycleCartridgeTypeEntity): CatalogTypeRow {
    return {
      id: row.id,
      key: row.key,
      label: row.label,
      desc: row.desc,
      color: row.color,
    };
  }

  private toBrand(row: RecycleBrandEntity): CatalogBrandRow {
    return {
      id: row.id,
      typeId: row.typeId,
      brand: row.brand,
      logo: row.logo,
    };
  }

  private toModel(row: RecycleModelEntity): CatalogModelRow {
    return {
      id: row.id,
      typeId: row.typeId,
      brandId: row.brandId,
      name: row.name,
      spec: row.spec,
      fits: row.fits,
      chip: row.chip,
      price: row.price,
    };
  }

  private async requireType(id: string): Promise<RecycleCartridgeTypeEntity> {
    const row = await this.typeRepo.findOne({ where: { id } });
    if (!row) {
      rpcFail(404, '类型不存在');
    }
    return row;
  }

  private async requireBrand(id: string): Promise<RecycleBrandEntity> {
    const row = await this.brandRepo.findOne({ where: { id } });
    if (!row) {
      rpcFail(404, '品牌不存在');
    }
    return row;
  }

  private async requireModel(id: string): Promise<RecycleModelEntity> {
    const row = await this.modelRepo.findOne({ where: { id } });
    if (!row) {
      rpcFail(404, '型号不存在');
    }
    return row;
  }

  private typeIdOf(value?: string): { typeId: string } | undefined {
    const typeId = optionalId(value, 'typeId');
    return typeId ? { typeId } : undefined;
  }
}
