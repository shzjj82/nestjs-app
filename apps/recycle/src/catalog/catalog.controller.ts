import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { ApiDoc, MQTT_GROUPS, MQTT_PATTERNS, sharePattern } from '@app/common';
import { CatalogService } from './catalog.service';

/**
 * 回收商品目录。单价在型号上，预估金额由前端 quantity × price 计算。
 */
@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  /** 一次性拿三张扁平表，省两次往返 */
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
  @ApiDoc({ name: '耗材类型列表', description: '墨盒 / 硒鼓' })
  types() {
    return this.catalog.types();
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_CATALOG_BRANDS),
  )
  @ApiDoc({ name: '品牌列表', description: '按 typeId 过滤' })
  brands(payload: Record<string, unknown>) {
    return this.catalog.brands(payload?.typeId as string | undefined);
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_CATALOG_MODELS),
  )
  @ApiDoc({
    name: '型号列表',
    description: '含回收单价；按 typeId / brandId 过滤',
  })
  models(payload: Record<string, unknown>) {
    return this.catalog.models(
      payload?.typeId as string | undefined,
      payload?.brandId as string | undefined,
    );
  }
}
