import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { TeamInfo, TeamMemberInfo, TeamRole } from '@app/common';
import { Repository } from 'typeorm';
import { normalizeAppCode } from '../apps/wechat-app-code';
import { BusinessesService } from '../businesses/businesses.service';
import { ClientsService } from '../apps/clients.service';
import { AccountEntity, TeamEntity, TeamMemberEntity } from '../entities';
import { optionalString, requiredString, rpcFail } from '../rpc';
import { canManageTeam, parseTeamRole } from './team-role';

export interface TeamScope {
  accountId: string;
  appCode: string;
  bizCode: string;
}

@Injectable()
export class TeamsService {
  constructor(
    @InjectRepository(TeamEntity)
    private readonly teams: Repository<TeamEntity>,
    @InjectRepository(TeamMemberEntity)
    private readonly members: Repository<TeamMemberEntity>,
    @InjectRepository(AccountEntity)
    private readonly accounts: Repository<AccountEntity>,
    private readonly businesses: BusinessesService,
    private readonly clients: ClientsService,
  ) {}

  async findAll(scope: TeamScope): Promise<TeamInfo[]> {
    await this.assertScope(scope);
    const rows = await this.membershipRows(scope);
    return rows.map((row) => this.toInfo(row.team, row.role));
  }

  async findOne(scope: TeamScope, teamId: string) {
    await this.assertScope(scope);
    const team = await this.requireTeam(teamId, scope.appCode, scope.bizCode);
    const me = await this.requireMember(team.id, scope.accountId);
    const members = await this.members.find({
      where: { teamId: team.id },
      relations: { account: true },
      order: { createdAt: 'ASC' },
    });
    return {
      team: this.toInfo(team, me.role),
      members: members.map((row) => this.toMember(row)),
    };
  }

  async create(scope: TeamScope, payload: Record<string, unknown>): Promise<TeamInfo> {
    await this.assertScope(scope);
    await this.requireAccountInApp(scope.accountId, scope.appCode);
    const name = requiredString(payload.name, 'name');
    if (name.length > 64) {
      rpcFail(400, '团队名称不能超过 64 字');
    }
    const now = new Date();
    const team = await this.teams.save(
      this.teams.create({
        appCode: scope.appCode,
        bizCode: scope.bizCode,
        name,
        description: optionalString(payload.description) ?? null,
        status: 1,
        createdAt: now,
        updatedAt: now,
      }),
    );
    await this.members.save(
      this.members.create({
        teamId: team.id,
        accountId: scope.accountId,
        role: 'owner',
        createdAt: now,
      }),
    );
    return this.toInfo(team, 'owner');
  }

  async join(scope: TeamScope, teamId: string): Promise<TeamInfo> {
    await this.assertScope(scope);
    await this.requireAccountInApp(scope.accountId, scope.appCode);
    const team = await this.requireTeam(teamId, scope.appCode, scope.bizCode);
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
        createdAt: new Date(),
      }),
    );
    return this.toInfo(team, row.role);
  }

  async leave(scope: TeamScope, teamId: string) {
    await this.assertScope(scope);
    const team = await this.requireTeam(teamId, scope.appCode, scope.bizCode);
    const me = await this.requireMember(team.id, scope.accountId);
    if (me.role === 'owner') {
      await this.assertOtherOwner(team.id, scope.accountId);
    }
    await this.members.delete({ id: me.id });
    return { left: true as const, teamId: team.id };
  }

  async setRole(
    scope: TeamScope,
    teamId: string,
    targetAccountId: string,
    roleRaw: unknown,
  ): Promise<TeamMemberInfo> {
    await this.assertScope(scope);
    const role = parseTeamRole(roleRaw);
    const team = await this.requireTeam(teamId, scope.appCode, scope.bizCode);
    const actor = await this.requireMember(team.id, scope.accountId);
    if (!canManageTeam(actor.role)) {
      rpcFail(403, '只有拥有者可以调整成员角色');
    }
    await this.requireAccountInApp(targetAccountId, scope.appCode);
    const target = await this.members.findOne({
      where: { teamId: team.id, accountId: targetAccountId },
      relations: { account: true },
    });
    if (!target) {
      rpcFail(404, '成员不存在');
    }
    if (target.role === 'owner' && role !== 'owner') {
      await this.assertOtherOwner(team.id, target.accountId);
    }
    target.role = role;
    await this.members.save(target);
    return this.toMember(target);
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

  private async assertScope(scope: TeamScope) {
    const business = await this.businesses.requireActiveByCode(scope.bizCode);
    // 业务 code 本身就是 appCode，不必再登记一条接入端
    if (scope.appCode === business.code) {
      return;
    }
    const client = await this.clients.requireByAppCode(scope.appCode);
    if (client.businessId && client.businessId !== business.id) {
      rpcFail(403, `接入端 ${scope.appCode} 不属于业务 ${scope.bizCode}`);
    }
  }

  private async requireAccountInApp(accountId: string, appCode: string) {
    const account = await this.accounts.findOne({
      where: { id: accountId },
      relations: { client: true },
    });
    if (!account || account.status !== 1) {
      rpcFail(404, '账户不存在或已停用');
    }
    if (account.client && account.client.appCode !== appCode) {
      rpcFail(403, '账户不属于当前应用');
    }
    return account;
  }

  private async requireTeam(id: string, appCode: string, bizCode: string) {
    const team = await this.teams.findOne({ where: { id } });
    if (!team || team.status !== 1 || team.appCode !== appCode || team.bizCode !== bizCode) {
      rpcFail(404, '团队不存在');
    }
    return team;
  }

  private async requireMember(teamId: string, accountId: string) {
    const row = await this.members.findOne({
      where: { teamId, accountId },
      relations: { account: true },
    });
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

  private toInfo(team: TeamEntity, role: TeamRole): TeamInfo {
    return {
      id: team.id,
      appCode: team.appCode,
      bizCode: team.bizCode,
      name: team.name,
      description: team.description,
      role,
      createdAt: team.createdAt.toISOString(),
    };
  }

  private toMember(row: TeamMemberEntity): TeamMemberInfo {
    return {
      id: row.id,
      accountId: row.accountId,
      accountType: row.account?.type ?? '',
      identifier: row.account?.identifier ?? '',
      role: row.role,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
