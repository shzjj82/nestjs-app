import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { ApiDoc, MQTT_GROUPS, MQTT_PATTERNS, sharePattern } from '@app/common';
import { CatalogService } from './catalog.service';

/**
 * 回收目录 + 估价接口。
 *
 * 目录是公开参考数据，不需要身份即可读（网关仍会要求登录），
 * 因此这里不取 actor —— 定价与鉴权都不在客户端手里，读目录无泄露面。
 */
@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  /** 一次性拿三张扁平表，省两次往返 */
  @MessagePattern(
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_CATALOG_ALL),
  )
  @ApiDoc({ name: '回收目录（三表全量）' })
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
  @ApiDoc({ name: '品牌列表', description: '一行 = 品牌 × 类型，可按 type 过滤' })
  brands(payload: Record<string, unknown>) {
    return this.catalog.brands(payload?.type as string | undefined);
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_CATALOG_MODELS),
  )
  @ApiDoc({
    name: '型号列表',
    description: '含回收单价；可按 type / brand 过滤',
  })
  models(payload: Record<string, unknown>) {
    return this.catalog.models(
      payload?.type as string | undefined,
      payload?.brand as string | undefined,
    );
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_QUOTE_CREATE),
  )
  @ApiDoc({
    name: '回收估价',
    description: '客户端只申报型号与数量，单价由服务端目录回填',
  })
  quote(payload: Record<string, unknown>) {
    return this.catalog.quote(payload?.items);
  }
}
