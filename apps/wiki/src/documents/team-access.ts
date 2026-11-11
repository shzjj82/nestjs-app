import { Injectable } from '@nestjs/common';
import type { TeamRole } from '@app/common';
import { TeamsService } from '../teams/teams.service';

export interface TeamGrant {
  teamId: string;
  role: TeamRole;
}

@Injectable()
export class TeamAccess {
  constructor(private readonly teams: TeamsService) {}

  async grants(input: {
    accountId: string;
    appCode: string;
    bizCode: string;
  }): Promise<TeamGrant[]> {
    const raw = await this.teams.memberships(input);
    return Array.isArray(raw?.items) ? raw.items : [];
  }
}
