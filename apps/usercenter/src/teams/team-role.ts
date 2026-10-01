import type { TeamRole } from '@app/common';
import { rpcFail } from '../rpc';

const ROLES: TeamRole[] = ['owner', 'developer', 'user'];

export function parseTeamRole(raw: unknown): TeamRole {
  if (typeof raw === 'string' && (ROLES as string[]).includes(raw)) {
    return raw as TeamRole;
  }
  rpcFail(400, '角色必须是 owner、developer 或 user');
}

/** 拥有者、开发者可改团队文档；使用者只读 */
export function canWriteTeamDocs(role: TeamRole): boolean {
  return role === 'owner' || role === 'developer';
}

export function canManageTeam(role: TeamRole): boolean {
  return role === 'owner';
}
