import { canManageTeam, canWriteTeamDocs } from './team-role';

describe('team role', () => {
  it('lets owner and developer write docs', () => {
    expect(canWriteTeamDocs('owner')).toBe(true);
    expect(canWriteTeamDocs('developer')).toBe(true);
    expect(canWriteTeamDocs('user')).toBe(false);
  });

  it('lets only the owner manage members', () => {
    expect(canManageTeam('owner')).toBe(true);
    expect(canManageTeam('developer')).toBe(false);
    expect(canManageTeam('user')).toBe(false);
  });
});
