import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { ApiDoc, MQTT_PATTERNS, UsercenterHandleLogInterceptor } from '@app/common';
import { asRecord, optionalString, requiredString, rpcFail } from '@app/common';
import { normalizeAppCode } from '../apps/wechat-app-code';
import { ucPattern } from '../rpc';
import { TeamsService, type TeamScope } from './teams.service';

@Controller()
@UseInterceptors(UsercenterHandleLogInterceptor)
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @MessagePattern(ucPattern(MQTT_PATTERNS.TEAM_FIND_ALL))
  @ApiDoc({ name: '我的团队', description: '当前账户在本应用、本业务下加入的团队' })
  findAll(payload: Record<string, unknown> = {}) {
    return this.teams.findAll(this.scope(payload));
  }

  @MessagePattern(ucPattern(MQTT_PATTERNS.TEAM_FIND_ONE))
  @ApiDoc({ name: '团队详情', description: '含成员与角色，仅成员可看' })
  findOne(payload: Record<string, unknown>) {
    return this.teams.findOne(this.scope(payload), requiredString(payload.id, 'id'));
  }

  @MessagePattern(ucPattern(MQTT_PATTERNS.TEAM_CREATE))
  @ApiDoc({ name: '创建团队', description: '创建者成为拥有者，并生成用于加入的团队码' })
  create(payload: Record<string, unknown>) {
    return this.teams.create(this.scope(payload), payload);
  }

  @MessagePattern(ucPattern(MQTT_PATTERNS.TEAM_JOIN))
  @ApiDoc({ name: '加入团队', description: '用团队码加入，当前账户成为使用者' })
  join(payload: Record<string, unknown>) {
    return this.teams.join(this.scope(payload), requiredString(payload.code, 'code'));
  }

  @MessagePattern(ucPattern(MQTT_PATTERNS.TEAM_REFRESH_CODE))
  @ApiDoc({ name: '刷新团队码', description: '拥有者重新生成加入码，旧码立即失效' })
  refreshCode(payload: Record<string, unknown>) {
    return this.teams.refreshCode(this.scope(payload), requiredString(payload.id, 'id'));
  }

  @MessagePattern(ucPattern(MQTT_PATTERNS.TEAM_LEAVE))
  @ApiDoc({ name: '离开团队', description: '最后一名拥有者需先移交' })
  leave(payload: Record<string, unknown>) {
    return this.teams.leave(this.scope(payload), requiredString(payload.id, 'id'));
  }

  @MessagePattern(ucPattern(MQTT_PATTERNS.TEAM_MEMBER_UPDATE))
  @ApiDoc({ name: '调整成员角色', description: '仅拥有者可设为 owner、developer 或 user' })
  setRole(payload: Record<string, unknown>) {
    return this.teams.setRole(
      this.scope(payload),
      requiredString(payload.id, 'id'),
      requiredString(payload.accountId, 'accountId'),
      payload.role,
    );
  }

  @MessagePattern(ucPattern(MQTT_PATTERNS.TEAM_MEMBERSHIPS))
  memberships(payload: Record<string, unknown>) {
    const accountId = requiredString(payload.accountId, 'accountId');
    const appCode = normalizeAppCode(requiredString(payload.appCode, 'appCode'));
    const bizCode = requiredString(payload.bizCode, 'bizCode');
    return this.teams.memberships({ accountId, appCode, bizCode });
  }

  private scope(payload: Record<string, unknown>): TeamScope {
    const session = asRecord(payload._session);
    const accountId = optionalString(session.accountId);
    const appCode = optionalString(payload._appCode) ?? optionalString(session.appId);
    const bizCode = optionalString(payload._bizCode);
    if (!accountId) {
      rpcFail(401, '需要登录账户');
    }
    if (!appCode) {
      rpcFail(400, 'appCode 必填');
    }
    if (!bizCode) {
      rpcFail(400, 'INVALID_BIZ_CODE');
    }
    return { accountId, appCode: normalizeAppCode(appCode), bizCode };
  }
}
