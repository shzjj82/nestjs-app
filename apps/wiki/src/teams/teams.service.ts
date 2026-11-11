import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import {
  MQTT_PATTERNS,
  USER_CLIENT,
  unwrapData,
  type TeamInfo,
  type TeamMemberInfo,
  type TeamRole,
  type UserAccountInfo,
} from '@app/common';
import { lastValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { Repository } from 'typeorm';
import { optionalString, requiredString, rpcFail } from '../common/rpc';
import { TeamEntity } from '../entities/team.entity';
import { TeamMemberEntity } from '../entities/team-member.entity';
import { generateTeamCode } from './team-code';
import { canManageTeam, parseTeamRole } from './team-role';

export interface TeamScope {
  accountId: string;
  appCode: string;
  bizCode: string;
}

@Injectable()
export class TeamsService implements OnModuleInit {
  constructor(
    @InjectRepository(TeamEntity)
    private readonly teams: Repository<TeamEntity>,
    @InjectRepository(TeamMemberEntity)
    private readonly members: Repository<TeamMemberEntity>,
    @Inject(USER_CLIENT) private readonly users: ClientProxy,
  ) {}

  async onModuleInit() {
    await this.users.connect();
  }

  async findAll(scope: TeamScope): Promise<TeamInfo[]> {
    this.assertScope(scope);
    const rows = await this.membershipRows(scope);
    return rows.map((row) => this.toInfo(row.team, row.role));
  }

  async findOne(scope: TeamScope, teamId: string) {
    this.assertScope(scope);
    const team = await this.requireTeam(teamId, scope.appCode, scope.bizCode);
    const me = await this.requireMember(team.id, scope.accountId);
    const members = await this.members.find({
      where: { teamId: team.id },
      order: { createdAt: 'ASC' },
    });
    const accounts = await this.loadAccounts(members.map((row) => row.accountId));
    return {
      team: this.toInfo(team, me.role),
      members: members.map((row) => this.toMember(row, accounts.get(row.accountId))),
    };
  }

  async create(scope: TeamScope, payload: Record<string, unknown>): Promise<TeamInfo> {
    this.assertScope(scope);
    const name = requiredString(payload.name, 'name');
    if (name.length > 64) {
      rpcFail(400, '团队名称不能超过 64 字');
    }
    const team = await this.teams.save(
      this.teams.create({
        appCode: scope.appCode,
        bizCode: scope.bizCode,
        code: await this.allocateCode(scope.appCode, scope.bizCode),
        name,
        description: optionalString(payload.description) ?? null,
        status: 1,
      }),
    );
    await this.members.save(
      this.members.create({
        teamId: team.id,
        accountId: scope.accountId,
        role: 'owner',
      }),
    );
    return this.toInfo(team, 'owner');
  }

  async join(scope: TeamScope, code: string): Promise<TeamInfo> {
    this.assertScope(scope);
    const team = await this.requireTeamByCode(code, scope.appCode, scope.bizCode);
    const existing = await this.members.findOne({
      where: { teamId: team.id, accountId: scope.accountId },
    });
    if (existing) {
      return this.toInfo(team, existing.role);
    }
    const row = await this.members.save(
      this.members.create({
        teamId: team.id,
        accountId: scope.accountId,
        role: 'user',
      }),
    );
    await this.touch(team);
    return this.toInfo(team, row.role);
  }

  async refreshCode(scope: TeamScope, teamId: string): Promise<TeamInfo> {
    this.assertScope(scope);
    const team = await this.requireTeam(teamId, scope.appCode, scope.bizCode);
    const actor = await this.requireMember(team.id, scope.accountId);
    if (!canManageTeam(actor.role)) {
      rpcFail(403, '只有拥有者可以刷新团队码');
    }
    team.code = await this.allocateCode(scope.appCode, scope.bizCode);
    await this.teams.save(team);
    return this.toInfo(team, actor.role);
  }

  async leave(scope: TeamScope, teamId: string) {
    this.assertScope(scope);
    const team = await this.requireTeam(teamId, scope.appCode, scope.bizCode);
    const me = await this.requireMember(team.id, scope.accountId);
    if (me.role === 'owner') {
      await this.assertOtherOwner(team.id, scope.accountId);
    }
    await this.members.delete({ id: me.id });
    await this.touch(team);
    return { left: true as const, teamId: team.id };
  }

  async setRole(
    scope: TeamScope,
    teamId: string,
    targetAccountId: string,
    roleRaw: unknown,
  ): Promise<TeamMemberInfo> {
    this.assertScope(scope);
    const role = parseTeamRole(roleRaw);
    const team = await this.requireTeam(teamId, scope.appCode, scope.bizCode);
    const actor = await this.requireMember(team.id, scope.accountId);
    if (!canManageTeam(actor.role)) {
      rpcFail(403, '只有拥有者可以调整成员角色');
    }
    const target = await this.members.findOne({
      where: { teamId: team.id, accountId: targetAccountId },
    });
    if (!target) {
      rpcFail(404, '成员不存在');
    }
    if (target.role === 'owner' && role !== 'owner') {
      await this.assertOtherOwner(team.id, target.accountId);
    }
    target.role = role;
    await this.members.save(target);
    await this.touch(team);
    const accounts = await this.loadAccounts([target.accountId]);
    return this.toMember(target, accounts.get(target.accountId));
  }

  async memberships(scope: Pick<TeamScope, 'accountId' | 'appCode' | 'bizCode'>) {
    const rows = await this.membershipRows({
      accountId: scope.accountId,
      appCode: normalizeAppCode(scope.appCode),
      bizCode: scope.bizCode,
    });
    return {
      items: rows.map((row) => ({ teamId: row.teamId, role: row.role })),
    };
  }

  private async membershipRows(scope: TeamScope) {
    return this.members
      .createQueryBuilder('member')
      .innerJoinAndSelect('member.team', 'team')
      .where('member.accountId = :accountId', { accountId: scope.accountId })
      .andWhere('team.appCode = :appCode', { appCode: scope.appCode })
      .andWhere('team.bizCode = :bizCode', { bizCode: scope.bizCode })
      .andWhere('team.status = 1')
      .orderBy('team.createdAt', 'DESC')
      .getMany();
  }

  private assertScope(scope: TeamScope) {
    if (!scope.accountId || !scope.appCode || !scope.bizCode) {
      rpcFail(400, '团队作用域不完整');
    }
  }

  private async allocateCode(appCode: string, bizCode: string) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const code = generateTeamCode();
      const exists = await this.teams.findOne({ where: { appCode, bizCode, code } });
      if (!exists) {
        return code;
      }
    }
    rpcFail(500, '团队码生成失败');
  }

  private async touch(team: TeamEntity) {
    await this.teams.update(team.id, { updatedAt: () => 'CURRENT_TIMESTAMP' });
  }

  private async requireTeam(id: string, appCode: string, bizCode: string) {
    const team = await this.teams.findOne({ where: { id } });
    if (!team || team.status !== 1 || team.appCode !== appCode || team.bizCode !== bizCode) {
      rpcFail(404, '团队不存在');
    }
    return team;
  }

  private async requireTeamByCode(code: string, appCode: string, bizCode: string) {
    const normalized = code.trim().toUpperCase();
    const team = await this.teams.findOne({
      where: { code: normalized, appCode, bizCode },
    });
    if (!team || team.status !== 1) {
      rpcFail(404, '团队码无效');
    }
    return team;
  }

  private async requireMember(teamId: string, accountId: string) {
    const row = await this.members.findOne({ where: { teamId, accountId } });
    if (!row) {
      rpcFail(403, '你不在该团队中');
    }
    return row;
  }

  private async assertOtherOwner(teamId: string, accountId: string) {
    const owners = await this.members.find({ where: { teamId, role: 'owner' } });
    if (!owners.some((row) => row.accountId !== accountId)) {
      rpcFail(400, '请先指定其他拥有者');
    }
  }

  private async loadAccounts(ids: string[]): Promise<Map<string, UserAccountInfo>> {
    const unique = [...new Set(ids.filter(Boolean))];
    if (!unique.length) {
      return new Map();
    }
    try {
      const raw = await lastValueFrom(
        this.users
          .send(MQTT_PATTERNS.ACCOUNT_FIND_MANY, { ids: unique })
          .pipe(timeout(8000)),
      );
      const rows = unwrapData<UserAccountInfo[]>(raw);
      return new Map((Array.isArray(rows) ? rows : []).map((row) => [row.id, row]));
    } catch {
      return new Map();
    }
  }

  private toInfo(team: TeamEntity, role: TeamRole): TeamInfo {
    return {
      id: team.id,
      appCode: team.appCode,
      bizCode: team.bizCode,
      code: team.code,
      name: team.name,
      description: team.description,
      role,
      createdAt: team.createdAt.toISOString(),
      updatedAt: team.updatedAt.toISOString(),
    };
  }

  private toMember(row: TeamMemberEntity, account?: UserAccountInfo): TeamMemberInfo {
    return {
      id: row.id,
      accountId: row.accountId,
      accountType: account?.type ?? '',
      identifier: account?.identifier ?? '',
      role: row.role,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

function normalizeAppCode(raw: string): string {
  return raw.trim();
}
