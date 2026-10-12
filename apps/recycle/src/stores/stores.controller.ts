import { Controller, Inject, forwardRef } from '@nestjs/common';
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
import { LiveRolesService } from '../identity/live-roles.service';
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
  constructor(
    private readonly stores: StoresService,
    @Inject(forwardRef(() => LiveRolesService))
    private readonly liveRoles: LiveRolesService,
  ) {}

  @MessagePattern(
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_STORE_FIND_ALL),
  )
  @ApiDoc({ name: '回收门店列表', description: '寄送/交投地址，公开' })
  list(payload: Record<string, unknown>) {
    return this.stores.list(publicBiz(payload));
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_STORE_NEARBY),
  )
  @ApiDoc({
    name: '就近门店列表',
    description:
      '小程序传入用户 longitude/latitude，按与门店坐标的直线距离升序返回；可选 limit、maxKm',
  })
  nearby(payload: Record<string, unknown>) {
    return this.stores.nearby(publicBiz(payload), payload);
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
  async create(payload: Record<string, unknown>) {
    const actor = await this.staffOf(payload, '创建门店');
    return this.stores.create(actor, bizCodeOf(payload, actor), payload);
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_STORE_UPDATE),
  )
  @ApiDoc({ name: '更新回收门店' })
  async update(payload: Record<string, unknown>) {
    const actor = await this.staffOf(payload, '更新门店');
    return this.stores.update(actor, bizCodeOf(payload, actor), payload);
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_STORE_DELETE),
  )
  @ApiDoc({ name: '停用回收门店' })
  async remove(payload: Record<string, unknown>) {
    const actor = await this.staffOf(payload, '下架门店');
    return this.stores.disable(
      actor,
      bizCodeOf(payload, actor),
      requiredString(payload.id, 'id'),
    );
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_STORE_STAFF),
  )
  @ApiDoc({ name: '门店已绑账号', description: '账户维度：标识 / 别名 / 业务角色，不含手机号' })
  async staff(payload: Record<string, unknown>) {
    const actor = await this.staffOf(payload, '查看门店账号');
    return this.stores.listStaff(
      actor,
      bizCodeOf(payload, actor),
      requiredString(payload.id, 'id'),
    );
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_STORE_STAFF_UPDATE),
  )
  @ApiDoc({ name: '更新门店绑定账号', description: '目前支持改别名 alias' })
  async updateStaff(payload: Record<string, unknown>) {
    const actor = await this.staffOf(payload, '更新门店账号');
    return this.stores.updateStaff(
      actor,
      bizCodeOf(payload, actor),
      requiredString(payload.id, 'id'),
      requiredString(payload.accountId, 'accountId'),
      payload,
    );
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_STORE_UNBIND),
  )
  @ApiDoc({ name: '解除门店与账号绑定' })
  async unbind(payload: Record<string, unknown>) {
    const actor = await this.staffOf(payload, '解除门店绑定');
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
  async qrcode(payload: Record<string, unknown>) {
    const actor = await this.staffOf(payload, '生成门店绑定码');
    return this.stores.qrcode(actor, bizCodeOf(payload, actor), payload);
  }

  private staffOf(payload: Record<string, unknown>, action: string) {
    return this.liveRoles.requireStaff(requireActor(payload), action);
  }
}
