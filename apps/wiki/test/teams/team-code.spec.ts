import { generateTeamCode, TEAM_CODE_LENGTH } from '../../src/teams/team-code';

describe('team code', () => {
  it('generates a fresh code each time', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateTeamCode()));
    expect(codes.size).toBe(20);
    for (const code of codes) {
      expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
      expect(code).toHaveLength(TEAM_CODE_LENGTH);
    }
  });
});
