import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import {
  ApiDoc,
  MQTT_GROUPS,
  MQTT_PATTERNS,
  requiredString,
  sharePattern,
} from '@app/common';
import { requireActor } from '../domain';
import { LiveRolesService } from '../identity/live-roles.service';
import { CatalogService } from './catalog.service';

/**
 * 回收商品目录。单价在型号上，预估金额由前端 quantity × price 计算。
 * 查询公开；增改下架需业务内非客户身份。
 */
@Controller()
export class CatalogController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly liveRoles: LiveRolesService,
  ) {}

  @MessagePattern(
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_CATALOG_ALL),
  )
  @ApiDoc({
    name: '回收目录（三表全量）',
    description: 'types.id / brands.typeId / models.typeId·brandId 互相关联',
  })
  all() {
    return this.catalog.all();
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_CATALOG_TYPES),
  )
  @ApiDoc({
    name: '耗材类型列表',
    description: '墨盒 / 硒鼓，也可自建类型；支持 page / pageSize',
  })
  types(payload: Record<string, unknown> = {}) {
    return this.catalog.types(payload);
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_CATALOG_BRANDS),
  )
  @ApiDoc({
    name: '品牌列表',
    description: '按 typeId 过滤；支持 page / pageSize',
  })
  brands(payload: Record<string, unknown> = {}) {
    return this.catalog.brands(payload);
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_CATALOG_MODELS),
  )
  @ApiDoc({
    name: '型号列表',
    description: '含回收单价；按 typeId / brandId 过滤；支持 page / pageSize',
  })
  models(payload: Record<string, unknown> = {}) {
    return this.catalog.models(payload);
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_CATALOG_TYPE_CREATE),
  )
  @ApiDoc({ name: '新增耗材类型' })
  async createType(payload: Record<string, unknown>) {
    await this.assertStaff(payload, '新增类型');
    return this.catalog.createType(payload);
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_CATALOG_TYPE_UPDATE),
  )
  @ApiDoc({ name: '更新耗材类型' })
  async updateType(payload: Record<string, unknown>) {
    await this.assertStaff(payload, '更新类型');
    return this.catalog.updateType(payload);
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_CATALOG_TYPE_DELETE),
  )
  @ApiDoc({ name: '下架耗材类型', description: '软删 enabled=false' })
  async deleteType(payload: Record<string, unknown>) {
    await this.assertStaff(payload, '下架类型');
    return this.catalog.disableType(requiredString(payload.id, 'id'));
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_CATALOG_BRAND_CREATE),
  )
  @ApiDoc({ name: '新增品牌' })
  async createBrand(payload: Record<string, unknown>) {
    await this.assertStaff(payload, '新增品牌');
    return this.catalog.createBrand(payload);
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_CATALOG_BRAND_UPDATE),
  )
  @ApiDoc({ name: '更新品牌' })
  async updateBrand(payload: Record<string, unknown>) {
    await this.assertStaff(payload, '更新品牌');
    return this.catalog.updateBrand(payload);
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_CATALOG_BRAND_DELETE),
  )
  @ApiDoc({ name: '下架品牌' })
  async deleteBrand(payload: Record<string, unknown>) {
    await this.assertStaff(payload, '下架品牌');
    return this.catalog.disableBrand(requiredString(payload.id, 'id'));
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_CATALOG_MODEL_CREATE),
  )
  @ApiDoc({ name: '新增型号', description: 'price 为回收指导价（分）' })
  async createModel(payload: Record<string, unknown>) {
    await this.assertStaff(payload, '新增型号');
    return this.catalog.createModel(payload);
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_CATALOG_MODEL_UPDATE),
  )
  @ApiDoc({ name: '更新型号 / 报价' })
  async updateModel(payload: Record<string, unknown>) {
    await this.assertStaff(payload, '更新型号');
    return this.catalog.updateModel(payload);
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_CATALOG_MODEL_DELETE),
  )
  @ApiDoc({ name: '下架型号' })
  async deleteModel(payload: Record<string, unknown>) {
    await this.assertStaff(payload, '下架型号');
    return this.catalog.disableModel(requiredString(payload.id, 'id'));
  }

  private assertStaff(payload: Record<string, unknown>, action: string) {
    return this.liveRoles.requireStaff(requireActor(payload), action);
  }
}
