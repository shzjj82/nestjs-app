import { of, throwError } from 'rxjs';
import type { Actor } from '../../src/domain';
import { LiveRolesService } from '../../src/identity/live-roles.service';

function actor(roles: string[]): Actor {
  return {
    userId: 'u-1',
    accountId: 'a-1',
    bizCode: 'recycle',
    roles,
    permissions: [],
    nickname: null,
    regionCode: null,
    openid: null,
    wechatAppId: null,
  };
}

describe('LiveRolesService', () => {
  it('covers JWT roles with live account roles', async () => {
    const users = {
      send: () => of([{ id: 'a-1', roles: ['customer', 'agent'] }]),
    };
    const live = new LiveRolesService(users as never);
    const out = await live.hydrate(actor(['customer']));
    expect(out.roles).toEqual(['customer', 'agent']);
  });

  it('keeps session roles when usercenter is down', async () => {
    const users = {
      send: () => throwError(() => new Error('timeout')),
    };
    const live = new LiveRolesService(users as never);
    const session = actor(['customer']);
    await expect(live.hydrate(session)).resolves.toEqual(session);
  });
});
