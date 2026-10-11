import type { DataSource } from 'typeorm';
import { CartridgeType } from '../domain';
import {
  RecycleBrandEntity,
  RecycleCartridgeTypeEntity,
  RecycleModelEntity,
} from '../entities';

/**
 * 回收目录种子数据。
 *
 * 数据来源：recycle-app 前端 `constants/index.ts` 里的 `BRAND_CATALOG`
 * （原本硬编码在小程序包里，改一次价要发一次版）。迁到服务端后
 * 改价 / 上下架只需改这里 + 重启，前端零改动。
 *
 * 价格口径：**只回收空耗材**（空墨盒 / 空硒鼓），单位「分」，区间 5~30 元/支；
 * 原装带芯片、可再利用性好的型号取高位；空硒鼓整体略高于空墨盒。
 *
 * 灌数方式：类型按 key、品牌按 (typeId, brand)、型号按 (brandId, name) upsert。
 */

type SeedType = {
  key: CartridgeType;
  label: string;
  desc: string;
  color: string;
};

type SeedBrand = { brand: string; type: CartridgeType; logo: string };

type SeedModel = {
  type: CartridgeType;
  brand: string;
  name: string;
  spec: string;
  fits: string;
  chip: boolean;
  price: number;
};

/**
 * 品牌 logo 暂不上（当前 UI 不消费，等需要时再把 CDN 地址写进 `logo` 字段即可）。
 * 表结构与 `BrandRow.logo` 字段保留，值恒为空串，前端降级为文字占位块。
 */
const NO_LOGO = '';

export const SEED_TYPES: SeedType[] = [
  {
    key: CartridgeType.INK,
    label: '墨盒',
    desc: '喷墨打印机空墨盒',
    color: '#3b82f6',
  },
  {
    key: CartridgeType.TONER,
    label: '硒鼓',
    desc: '激光打印机空硒鼓',
    color: '#8b5cf6',
  },
];

export const SEED_BRANDS: SeedBrand[] = [
  { brand: '惠普 HP', type: CartridgeType.INK, logo: NO_LOGO },
  { brand: '佳能 Canon', type: CartridgeType.INK, logo: NO_LOGO },
  { brand: '爱普生 Epson', type: CartridgeType.INK, logo: NO_LOGO },
  { brand: '兄弟 Brother', type: CartridgeType.INK, logo: NO_LOGO },
  { brand: '惠普 HP', type: CartridgeType.TONER, logo: NO_LOGO },
  { brand: '佳能 Canon', type: CartridgeType.TONER, logo: NO_LOGO },
  { brand: '兄弟 Brother', type: CartridgeType.TONER, logo: NO_LOGO },
  { brand: '联想 Lenovo', type: CartridgeType.TONER, logo: NO_LOGO },
  { brand: '三星 Samsung', type: CartridgeType.TONER, logo: NO_LOGO },
];

export const SEED_MODELS: SeedModel[] = [
  // ───────── 空墨盒（喷墨） ─────────
  { type: CartridgeType.INK, brand: '惠普 HP', name: 'HP 803 黑色', spec: '黑色标准容量', fits: 'DeskJet 1112 / 2130 / 2620', chip: true, price: 900 },
  { type: CartridgeType.INK, brand: '惠普 HP', name: 'HP 805 三色', spec: '彩色三色', fits: 'DeskJet 2720 / 2729 / 2330', chip: true, price: 1100 },
  { type: CartridgeType.INK, brand: '惠普 HP', name: 'HP 46 黑色', spec: '黑色标准容量', fits: 'DeskJet 4720 / Ink Tank 415', chip: true, price: 900 },
  { type: CartridgeType.INK, brand: '惠普 HP', name: 'HP 950XL 黑色', spec: '黑色大容量', fits: 'OfficeJet Pro 8100 / 8600', chip: true, price: 1600 },
  { type: CartridgeType.INK, brand: '惠普 HP', name: 'HP 953XL 四色套装', spec: '四色大容量套装', fits: 'OfficeJet Pro 8100 / 8610', chip: true, price: 2100 },

  { type: CartridgeType.INK, brand: '佳能 Canon', name: 'PG-845 黑色', spec: '黑色标准容量', fits: 'PIXMA MG2400 / MG2580', chip: true, price: 1000 },
  { type: CartridgeType.INK, brand: '佳能 Canon', name: 'PG-845XL 黑色', spec: '黑色大容量', fits: 'PIXMA MG3600 / MG3680', chip: true, price: 1300 },
  { type: CartridgeType.INK, brand: '佳能 Canon', name: 'CL-846 彩色', spec: '彩色三色', fits: 'PIXMA MG2400 / MG2580', chip: true, price: 1200 },
  { type: CartridgeType.INK, brand: '佳能 Canon', name: 'CLI-851 彩色', spec: '彩色三色', fits: 'PIXMA iP7280 / MX728', chip: true, price: 1400 },
  { type: CartridgeType.INK, brand: '佳能 Canon', name: 'PGI-870 黑色', spec: '黑色标准容量', fits: 'PIXMA MG7780 / MG6880', chip: true, price: 1400 },

  { type: CartridgeType.INK, brand: '爱普生 Epson', name: 'T1091 黑色', spec: '黑色标准容量', fits: 'ME-33 / ME-330 / ME-350', chip: false, price: 800 },
  { type: CartridgeType.INK, brand: '爱普生 Epson', name: 'T1911 黑色', spec: '黑色标准容量', fits: 'WorkForce WF-2531 / WF-2541', chip: true, price: 950 },
  { type: CartridgeType.INK, brand: '爱普生 Epson', name: 'T0731 黑色', spec: '黑色照片级', fits: 'Stylus Photo T50 / R270', chip: false, price: 1000 },
  { type: CartridgeType.INK, brand: '爱普生 Epson', name: 'T1912 彩色三色', spec: '彩色三色', fits: 'WorkForce WF-2531 / WF-2541', chip: true, price: 1300 },
  { type: CartridgeType.INK, brand: '爱普生 Epson', name: 'T1911-T1914 四色套装', spec: '四色套装', fits: 'WorkForce WF-2531 / WF-2541', chip: true, price: 1800 },

  { type: CartridgeType.INK, brand: '兄弟 Brother', name: 'LC-461 黑色', spec: '黑色标准容量', fits: 'DCP-T425W / MFC-T920DW', chip: false, price: 900 },
  { type: CartridgeType.INK, brand: '兄弟 Brother', name: 'LC-495XL 黑色', spec: '黑色大容量', fits: 'MFC-J3930DW / J3530DW', chip: true, price: 1400 },
  { type: CartridgeType.INK, brand: '兄弟 Brother', name: 'LC-495XL 彩色', spec: '彩色三色大容量', fits: 'MFC-J3930DW / J3530DW', chip: true, price: 1500 },

  // ───────── 空硒鼓（激光） ─────────
  { type: CartridgeType.TONER, brand: '惠普 HP', name: 'Q2612A（12A）', spec: '黑色标准容量', fits: 'LaserJet 1010 / 1020 / M1005', chip: true, price: 1800 },
  { type: CartridgeType.TONER, brand: '惠普 HP', name: 'CC388A（88A）', spec: '黑色标准容量', fits: 'LaserJet P1007 / P1008 / M1136', chip: true, price: 1900 },
  { type: CartridgeType.TONER, brand: '惠普 HP', name: 'CF226X（26X）', spec: '黑色大容量', fits: 'LaserJet Pro M402 / M426', chip: true, price: 2300 },
  { type: CartridgeType.TONER, brand: '惠普 HP', name: 'CF400A（201A）四色套装', spec: '四色套装', fits: 'Color LaserJet Pro M252 / M277', chip: true, price: 2500 },

  { type: CartridgeType.TONER, brand: '佳能 Canon', name: 'CRG-337 黑色', spec: '黑色标准容量', fits: 'LBP-6030 / 6030w', chip: true, price: 1800 },
  { type: CartridgeType.TONER, brand: '佳能 Canon', name: 'CRG-912 黑色', spec: '黑色标准容量', fits: 'LBP-3018 / 3108', chip: false, price: 1600 },
  { type: CartridgeType.TONER, brand: '佳能 Canon', name: 'CRG-054 四色套装', spec: '四色套装', fits: 'LBP-621C / 623Cdw', chip: true, price: 2500 },

  { type: CartridgeType.TONER, brand: '兄弟 Brother', name: 'TN-2010 黑色', spec: '黑色标准容量', fits: 'HL-2240 / DCP-7060', chip: false, price: 1500 },
  { type: CartridgeType.TONER, brand: '兄弟 Brother', name: 'TN-2325 黑色高容', spec: '黑色大容量', fits: 'HL-2560DN / HL-2260', chip: true, price: 2000 },
  { type: CartridgeType.TONER, brand: '兄弟 Brother', name: 'DR-2350 鼓组件', spec: '感光鼓组件', fits: 'HL-2560DN / DCP-7180DN', chip: false, price: 2100 },

  { type: CartridgeType.TONER, brand: '联想 Lenovo', name: 'LT2451 黑色', spec: '黑色标准容量', fits: 'LJ2400 / M7400 / M7450', chip: false, price: 1500 },
  { type: CartridgeType.TONER, brand: '联想 Lenovo', name: 'LD100 鼓组件', spec: '感光鼓组件', fits: 'LJ2206 / M2250', chip: false, price: 1800 },
  { type: CartridgeType.TONER, brand: '联想 Lenovo', name: 'LT201 四色套装', spec: '四色套装', fits: 'CS1831 / CS2010DW', chip: true, price: 2400 },

  { type: CartridgeType.TONER, brand: '三星 Samsung', name: 'MLT-D116L 黑色', spec: '黑色大容量', fits: 'SL-M2626 / M2826ND', chip: true, price: 1700 },
  { type: CartridgeType.TONER, brand: '三星 Samsung', name: 'CLT-K406S 四色套装', spec: '四色套装', fits: 'SL-C430 / C480W', chip: true, price: 2400 },
];

/** 按唯一键 upsert，重复执行幂等 */
export async function seedCatalog(dataSource: DataSource): Promise<void> {
  const types = dataSource.getRepository(RecycleCartridgeTypeEntity);
  const brands = dataSource.getRepository(RecycleBrandEntity);
  const models = dataSource.getRepository(RecycleModelEntity);

  await types.upsert(
    SEED_TYPES.map((row, index) => ({ ...row, sort: index + 1, enabled: true })),
    ['key'],
  );
  const typeRows = await types.find();
  const typeIdByKey = new Map(typeRows.map((row) => [row.key, row.id]));

  await brands.upsert(
    SEED_BRANDS.map((row, index) => {
      const typeId = typeIdByKey.get(row.type);
      if (!typeId) {
        throw new Error(`目录种子缺少类型 ${row.type}`);
      }
      return {
        typeId,
        brand: row.brand,
        logo: row.logo,
        sort: index + 1,
        enabled: true,
      };
    }),
    ['typeId', 'brand'],
  );
  const brandRows = await brands.find();
  const brandIdByScope = new Map(
    brandRows.map((row) => [`${row.typeId}:${row.brand}`, row.id]),
  );

  await models.upsert(
    SEED_MODELS.map((row, index) => {
      const typeId = typeIdByKey.get(row.type);
      if (!typeId) {
        throw new Error(`目录种子缺少类型 ${row.type}`);
      }
      const brandId = brandIdByScope.get(`${typeId}:${row.brand}`);
      if (!brandId) {
        throw new Error(`目录种子缺少品牌 ${row.type}/${row.brand}`);
      }
      return {
        typeId,
        brandId,
        name: row.name,
        spec: row.spec,
        fits: row.fits,
        chip: row.chip,
        price: row.price,
        sort: index + 1,
        enabled: true,
      };
    }),
    ['brandId', 'name'],
  );
}
