import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import {
  ApiDoc,
  MQTT_GROUPS,
  MQTT_PATTERNS,
  optionalString,
  requiredString,
  rpcFail,
  sharePattern,
} from '@app/common';
import { bizCodeOf, requireActor } from '../domain';
import { StoresService } from './stores.service';

function publicBiz(payload: Record<string, unknown>): string {
  const code = optionalString(payload._bizCode);
  if (!code) {
    rpcFail(400, '缺少业务标识');
  }
  return code;
}

@Controller()
export class StoresController {
  constructor(private readonly stores: StoresService) {}

  @MessagePattern(
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_STORE_FIND_ALL),
  )
  @ApiDoc({ name: '回收门店列表', description: '寄送/交投地址，公开' })
  list(payload: Record<string, unknown>) {
    return this.stores.list(publicBiz(payload));
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_STORE_MINE),
  )
  @ApiDoc({ name: '我绑定的门店' })
  mine(payload: Record<string, unknown>) {
    const actor = requireActor(payload);
    return this.stores.mine(actor, bizCodeOf(payload, actor));
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_STORE_FIND_ONE),
  )
  @ApiDoc({ name: '门店详情' })
  findOne(payload: Record<string, unknown>) {
    return this.stores.detail(
      publicBiz(payload),
      requiredString(payload.id, 'id'),
    );
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_STORE_CREATE),
  )
  @ApiDoc({ name: '新增回收门店' })
  create(payload: Record<string, unknown>) {
    const actor = requireActor(payload);
    return this.stores.create(actor, bizCodeOf(payload, actor), payload);
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_STORE_UPDATE),
  )
  @ApiDoc({ name: '更新回收门店' })
  update(payload: Record<string, unknown>) {
    const actor = requireActor(payload);
    return this.stores.update(actor, bizCodeOf(payload, actor), payload);
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_STORE_DELETE),
  )
  @ApiDoc({ name: '停用回收门店' })
  remove(payload: Record<string, unknown>) {
    const actor = requireActor(payload);
    return this.stores.disable(
      actor,
      bizCodeOf(payload, actor),
      requiredString(payload.id, 'id'),
    );
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_STORE_STAFF),
  )
  @ApiDoc({ name: '门店已绑账号' })
  staff(payload: Record<string, unknown>) {
    const actor = requireActor(payload);
    return this.stores.listStaff(
      actor,
      bizCodeOf(payload, actor),
      requiredString(payload.id, 'id'),
    );
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_STORE_UNBIND),
  )
  @ApiDoc({ name: '解除门店与账号绑定' })
  unbind(payload: Record<string, unknown>) {
    const actor = requireActor(payload);
    return this.stores.unbind(
      actor,
      bizCodeOf(payload, actor),
      requiredString(payload.id, 'id'),
      requiredString(payload.accountId, 'accountId'),
    );
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_STORE_BIND),
  )
  @ApiDoc({
    name: '扫码绑定门店',
    description: '小程序码 scene 对应当前门店，登录账号写入绑定表',
  })
  bind(payload: Record<string, unknown>) {
    const actor = requireActor(payload);
    return this.stores.bind(
      actor,
      bizCodeOf(payload, actor),
      requiredString(payload.scene, 'scene'),
    );
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_STORE_QRCODE),
  )
  @ApiDoc({
    name: '门店绑定小程序码',
    description: '内部调微信 getwxacodeunlimit，上传 OSS 后返回 url / scene',
  })
  qrcode(payload: Record<string, unknown>) {
    const actor = requireActor(payload);
    return this.stores.qrcode(actor, bizCodeOf(payload, actor), payload);
  }
}
