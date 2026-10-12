import { Injectable } from '@nestjs/common';
import { rpcFail, type PageResult } from '@app/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { CartridgeType, isCartridgeType } from '../domain';
import {
  RecycleBrandEntity,
  RecycleCartridgeTypeEntity,
  RecycleModelEntity,
} from '../entities';
import {
  optionalBool,
  optionalId,
  optionalNonNegInt,
  optionalTrim,
  parseNonNegInt,
  parseTypeKey,
  requireId,
  requiredTrim,
  toCatalogPage,
} from './catalog-write';

export interface CatalogPriceItem {
  typeId?: string;
  brandId?: string;
  modelId: string;
  quantity: number;
}

export interface CatalogTypeRow {
  id: string;
  key: string;
  label: string;
  desc: string;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogBrandRow {
  id: string;
  typeId: string;
  brand: string;
  logo: string;
  createdAt: string;
  updatedAt: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface QuoteLine {
  typeId: string;
  brandId: string;
  modelId: string;
  cartridgeType: CartridgeType;
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

  async types(payload: Record<string, unknown> = {}): Promise<PageResult<CatalogTypeRow>> {
    return this.pageQuery(
      this.typeRepo,
      { enabled: true },
      { sort: 'ASC' },
      payload,
      (row) => this.toType(row),
    );
  }

  async brands(payload: Record<string, unknown> = {}): Promise<PageResult<CatalogBrandRow>> {
    const where: FindOptionsWhere<RecycleBrandEntity> = { enabled: true };
    Object.assign(where, this.typeIdOf(payload.typeId as string | undefined) ?? {});
    return this.pageQuery(
      this.brandRepo,
      where,
      { sort: 'ASC' },
      payload,
      (row) => this.toBrand(row),
    );
  }

  async models(payload: Record<string, unknown> = {}): Promise<PageResult<CatalogModelRow>> {
    const where: FindOptionsWhere<RecycleModelEntity> = { enabled: true };
    const typeId = optionalId(payload.typeId, 'typeId');
    if (typeId) where.typeId = typeId;
    const brandId = optionalId(payload.brandId, 'brandId');
    if (brandId) where.brandId = brandId;
    return this.pageQuery(
      this.modelRepo,
      where,
      { sort: 'ASC' },
      payload,
      (row) => this.toModel(row),
    );
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
    return {
      types: types.items,
      brands: brands.items,
      models: models.items,
    };
  }

  async priceItems(items: CatalogPriceItem[]): Promise<QuoteLine[]> {
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
      if (!isCartridgeType(row.typeRef.key)) {
        rpcFail(400, '型号的耗材类型无效');
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
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toBrand(row: RecycleBrandEntity): CatalogBrandRow {
    return {
      id: row.id,
      typeId: row.typeId,
      brand: row.brand,
      logo: row.logo,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
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
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
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

  private async pageQuery<E extends object, T>(
    repo: Repository<E>,
    where: FindOptionsWhere<E>,
    order: Record<string, 'ASC' | 'DESC'>,
    payload: Record<string, unknown>,
    map: (row: E) => T,
  ): Promise<PageResult<T>> {
    const paging = toCatalogPage(payload.page, payload.pageSize);
    const [rows, total] = await repo.findAndCount({
      where,
      order: order as never,
      ...(paging ? { skip: paging.skip, take: paging.pageSize } : {}),
    });
    const items = rows.map(map);
    return {
      items,
      total,
      page: paging?.page ?? 1,
      pageSize: paging?.pageSize ?? total,
    };
  }
}
