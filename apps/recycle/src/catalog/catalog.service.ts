import { Injectable } from '@nestjs/common';
import { rpcFail } from '@app/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CartridgeType } from '../domain';
import {
  RecycleBrandEntity,
  RecycleCartridgeTypeEntity,
  RecycleModelEntity,
} from '../entities';
import {
  optionalId,
  readQuoteItems,
  type QuoteRequestItem,
} from './catalog-items';

export type { QuoteRequestItem } from './catalog-items';

export interface CatalogTypeRow {
  id: string;
  key: CartridgeType;
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

  private typeIdOf(value?: string): { typeId: string } | undefined {
    const typeId = optionalId(value, 'typeId');
    return typeId ? { typeId } : undefined;
  }
}
