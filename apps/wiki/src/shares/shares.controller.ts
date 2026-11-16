import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import {
  ApiDoc,
  DocsHandleLogInterceptor,
  MQTT_GROUPS,
  MQTT_PATTERNS,
  sharePattern,
} from '@app/common';
import { SharesService } from './shares.service';

@Controller()
@UseInterceptors(DocsHandleLogInterceptor)
export class SharesController {
  constructor(private readonly shares: SharesService) {}

  @MessagePattern(
    sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_SHARE_CREATE),
  )
  @ApiDoc({
    name: '创建页面分享',
    description:
      '登录后按文档读取权限保存标题和正文快照。不接受前端直接上传正文。',
  })
  create(payload: Record<string, unknown>) {
    return this.shares.create(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_SHARE_LIST))
  @ApiDoc({
    name: '页面分享列表',
    description: '只返回该页面上调用者能管理、且未撤销的链接，不含正文。',
  })
  list(payload: Record<string, unknown>) {
    return this.shares.list(payload);
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_SHARE_REVOKE),
  )
  @ApiDoc({
    name: '撤销页面分享',
    description:
      '创建者或文档作者写入撤销时间。父链接撤销后，子链接读取时失效。',
  })
  revoke(payload: Record<string, unknown>) {
    return this.shares.revoke(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_SHARE_VIEW))
  @ApiDoc({
    name: '查看分享快照',
    description:
      '不登录。链接失效、撤销或过期都返回 SHARE_UNAVAILABLE，不区分原因。',
  })
  view(payload: Record<string, unknown>) {
    return this.shares.view(payload);
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_SHARE_RESHARE),
  )
  @ApiDoc({
    name: '再分享',
    description: '不登录。父链接仍有效且允许再分享时，复制快照并收紧到期时间。',
  })
  reshare(payload: Record<string, unknown>) {
    return this.shares.reshare(payload);
  }
}
