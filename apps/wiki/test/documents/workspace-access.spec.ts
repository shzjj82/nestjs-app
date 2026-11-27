import { canReadWorkspacePost } from '../../src/modules/documents/workspace-access';

const AUTHOR = 'author';
const TEAMMATE = 'teammate';
const OUTSIDER = 'outsider';
const TEAM = 'team-1';

describe('workspace team sharing', () => {
  it('lets a teammate read a team page even when the child is stored as public', () => {
    expect(
      canReadWorkspacePost({
        visibility: 'public',
        authorId: AUTHOR,
        actorId: TEAMMATE,
        lineageTeamIds: [TEAM],
        readableTeamIds: [TEAM],
      }),
    ).toBe(true);
  });

  it('lets a teammate read a private team page and a page that only an ancestor belongs to the team', () => {
    expect(
      canReadWorkspacePost({
        visibility: 'private',
        authorId: AUTHOR,
        actorId: TEAMMATE,
        lineageTeamIds: [TEAM],
        readableTeamIds: [TEAM],
      }),
    ).toBe(true);
    expect(
      canReadWorkspacePost({
        visibility: 'public',
        authorId: AUTHOR,
        actorId: TEAMMATE,
        lineageTeamIds: ['parent-team'],
        readableTeamIds: ['parent-team'],
      }),
    ).toBe(true);
  });

  it('keeps another person’s personal page closed', () => {
    expect(
      canReadWorkspacePost({
        visibility: 'private',
        authorId: AUTHOR,
        actorId: OUTSIDER,
        lineageTeamIds: [],
        readableTeamIds: [TEAM],
      }),
    ).toBe(false);
    expect(
      canReadWorkspacePost({
        visibility: 'public',
        authorId: AUTHOR,
        actorId: OUTSIDER,
        lineageTeamIds: [],
        readableTeamIds: [TEAM],
      }),
    ).toBe(false);
    expect(
      canReadWorkspacePost({
        visibility: 'private',
        authorId: AUTHOR,
        actorId: undefined,
        lineageTeamIds: [TEAM],
        readableTeamIds: [],
      }),
    ).toBe(false);
  });
});
