jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import { RpcException } from '@nestjs/microservices';
import {
  SharesService,
  SHARE_BODY_LIMIT,
} from '../../src/shares/shares.service';
import { WikiShareEntity } from '../../src/entities/wiki-share.entity';

const PAGE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_PAGE = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const OWNER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const AUTHOR = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const OTHER = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const SOURCE = {
  time: 1,
  version: '2.30.7',
  blocks: [{ type: 'paragraph', data: { text: '原文' } }],
};

const UNAVAILABLE = {
  status: 404,
  message: '分享链接不可用',
  code: 'SHARE_UNAVAILABLE',
};

function authed(accountId: string, extra: Record<string, unknown> = {}) {
  return {
    _appCode: 'wiki',
    _bizCode: 'wiki',
    _session: { accountId, userId: 'user-1' },
    ...extra,
  };
}

function memoryShares() {
  const rows: WikiShareEntity[] = [];
  return {
    rows,
    create(partial: WikiShareEntity) {
      return partial;
    },
    save(row: WikiShareEntity) {
      const copy = { ...row };
      const index = rows.findIndex((item) => item.token === row.token);
      if (index >= 0) {
        rows[index] = copy;
      } else {
        rows.push(copy);
      }
      return Promise.resolve(copy);
    },
    findOne(options: { where: { token?: string } }) {
      return Promise.resolve(
        rows.find((item) => item.token === options.where.token) ?? null,
      );
    },
    find(options: {
      where: Record<string, unknown> | Array<Record<string, unknown>>;
    }) {
      const filters = Array.isArray(options.where)
        ? options.where
        : [options.where];
      return Promise.resolve(
        rows.filter((row) =>
          filters.some((filter) =>
            matches(row as unknown as Record<string, unknown>, filter),
          ),
        ),
      );
    },
  };
}

function matches(
  row: Record<string, unknown>,
  filter: Record<string, unknown>,
): boolean {
  return Object.entries(filter).every(([key, expected]) => {
    const actual = row[key];
    if (
      typeof expected === 'object' &&
      expected !== null &&
      'type' in expected
    ) {
      return (expected as { type?: string }).type === 'isNull'
        ? actual == null
        : false;
    }
    return actual === expected;
  });
}

async function rpcError(run: Promise<unknown>) {
  try {
    await run;
    throw new Error('expected rpc failure');
  } catch (err) {
    if (err instanceof Error && err.message === 'expected rpc failure') {
      throw err;
    }
    expect(err).toBeInstanceOf(RpcException);
    return (err as RpcException).getError();
  }
}

describe('wiki shares', () => {
  const post = {
    id: PAGE,
    appCode: 'wiki',
    title: '周报',
    authorId: AUTHOR,
    body: SOURCE,
  };

  function setup() {
    const repo = memoryShares();
    const findById = jest.fn((_payload: unknown, pageId: string) => ({
      ...post,
      id: pageId,
    }));
    const service = new SharesService(repo as never, { findById } as never);
    return { repo, findById, service };
  }

  it('snapshots the readable page and ignores uploaded body, authorId, and jwt', async () => {
    const { service, findById, repo } = setup();
    const before = Date.now();
    const created = await service.create(
      authed(OWNER, {
        pageId: PAGE,
        expiresIn: 604800,
        allowReshare: true,
        title: '伪造标题',
        body: { blocks: [{ type: 'paragraph', data: { text: '伪造正文' } }] },
        authorId: OTHER,
        accountId: OTHER,
        _token: 'jwt-secret-do-not-store',
      }),
    );
    const after = Date.now();

    expect(typeof created.token).toBe('string');
    expect(created.urlPath).toBe(`/s/${created.token}`);
    expect(created.pageId).toBe(PAGE);
    expect(created.title).toBe('周报');
    expect(typeof created.expiresAt).toBe('string');
    expect(created.allowReshare).toBe(true);
    const expiresAt = Date.parse(created.expiresAt ?? '');
    expect(expiresAt).toBeGreaterThanOrEqual(before + 604800 * 1000);
    expect(expiresAt).toBeLessThanOrEqual(after + 604800 * 1000);

    const arg = findById.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.id).toBe(PAGE);
    expect(arg.authorId).toBeUndefined();
    expect(arg.body).toBeUndefined();
    expect(arg._token).toBeUndefined();
    expect(arg.accountId).toBeUndefined();
    expect((arg._session as { accountId: string }).accountId).toBe(OWNER);

    expect(repo.rows).toHaveLength(1);
    expect(repo.rows[0]).toMatchObject({
      pageId: PAGE,
      title: '周报',
      body: SOURCE,
      ownerAccountId: OWNER,
      pageOwnerAccountId: AUTHOR,
      createdBy: OWNER,
      allowReshare: true,
      parentToken: null,
      revokedAt: null,
    });
    expect(JSON.stringify(repo.rows[0])).not.toContain(
      'jwt-secret-do-not-store',
    );
    expect(repo.rows[0]).not.toHaveProperty('_token');
  });

  it('treats omitted and null expiresIn as never, and only true as reshare', async () => {
    const { service } = setup();
    const omitted = await service.create(authed(OWNER, { pageId: PAGE }));
    const empty = await service.create(
      authed(OWNER, { pageId: PAGE, expiresIn: null, allowReshare: 'true' }),
    );
    expect(omitted.expiresAt).toBeNull();
    expect(omitted.allowReshare).toBe(false);
    expect(empty.expiresAt).toBeNull();
    expect(empty.allowReshare).toBe(false);
  });

  it('rejects expiresIn outside 60 seconds to 366 days', async () => {
    const { service, findById, repo } = setup();
    const max = 366 * 24 * 60 * 60;
    const tooSmall = await rpcError(
      service.create(authed(OWNER, { pageId: PAGE, expiresIn: 59 })),
    );
    const tooBig = await rpcError(
      service.create(authed(OWNER, { pageId: PAGE, expiresIn: max + 1 })),
    );
    const text = await rpcError(
      service.create(authed(OWNER, { pageId: PAGE, expiresIn: '604800' })),
    );
    const fraction = await rpcError(
      service.create(authed(OWNER, { pageId: PAGE, expiresIn: 60.5 })),
    );
    for (const error of [tooSmall, tooBig, text, fraction]) {
      expect(error).toEqual({
        status: 400,
        code: 'INVALID_EXPIRES_IN',
        message: '有效期须为 60 秒到 366 天的整数秒，或留空表示不过期',
      });
    }
    expect(findById).not.toHaveBeenCalled();
    expect(repo.rows).toHaveLength(0);

    const edge = await service.create(
      authed(OWNER, { pageId: PAGE, expiresIn: max }),
    );
    expect(typeof edge.expiresAt).toBe('string');
  });

  it('maps missing and forbidden documents to the same PAGE_UNREADABLE', async () => {
    const { service, findById, repo } = setup();
    findById.mockRejectedValueOnce(
      new RpcException({ status: 404, message: 'NOT_FOUND' }),
    );
    const missing = await rpcError(
      service.create(authed(OWNER, { pageId: PAGE })),
    );
    findById.mockRejectedValueOnce(
      new RpcException({ status: 403, message: 'FORBIDDEN' }),
    );
    const forbidden = await rpcError(
      service.create(authed(OWNER, { pageId: PAGE })),
    );
    const unreadable = {
      status: 404,
      code: 'PAGE_UNREADABLE',
      message: '页面不可读',
    };
    expect(missing).toEqual(unreadable);
    expect(forbidden).toEqual(unreadable);
    expect(repo.rows).toHaveLength(0);

    const blank = await rpcError(service.create(authed(OWNER, {})));
    expect(blank).toEqual(unreadable);
  });

  it('rejects snapshots over the size limit', async () => {
    const { service, findById, repo } = setup();
    findById.mockResolvedValue({
      ...post,
      body: {
        blocks: [
          { type: 'paragraph', data: { text: 'x'.repeat(SHARE_BODY_LIMIT) } },
        ],
      },
    });
    const error = await rpcError(
      service.create(authed(OWNER, { pageId: PAGE, expiresIn: 60 })),
    );
    expect(error).toEqual({
      status: 400,
      code: 'SHARE_TOO_LARGE',
      message: '正文过大，无法分享',
    });
    expect(repo.rows).toHaveLength(0);
  });

  it('lists only manageable active links for that page, without the body', async () => {
    const { service } = setup();
    const mine = await service.create(
      authed(OWNER, { pageId: PAGE, allowReshare: false }),
    );
    const authors = await service.create(
      authed(AUTHOR, { pageId: PAGE, expiresIn: 120 }),
    );
    await service.create(authed(OWNER, { pageId: OTHER_PAGE }));
    const revoked = await service.create(authed(OWNER, { pageId: PAGE }));
    await service.revoke(authed(AUTHOR, { token: revoked.token }));

    const asOwner = await service.list(authed(OWNER, { pageId: PAGE }));
    expect(asOwner.shares.map((item) => item.token)).toEqual([mine.token]);
    expect(asOwner.shares[0]).not.toHaveProperty('body');
    expect(asOwner.shares[0]).toMatchObject({
      pageId: PAGE,
      title: '周报',
      parentToken: null,
      allowReshare: false,
      expiresAt: null,
    });

    const asAuthor = await service.list(authed(AUTHOR, { pageId: PAGE }));
    expect(asAuthor.shares.map((item) => item.token).sort()).toEqual(
      [mine.token, authors.token].sort(),
    );

    const asOther = await service.list(authed(OTHER, { pageId: PAGE }));
    expect(asOther.shares).toEqual([]);
    expect(await service.list(authed(OWNER, { pageId: 'not-a-uuid' }))).toEqual(
      { shares: [] },
    );

    const missingPage = await rpcError(service.list(authed(OWNER, {})));
    expect(missingPage).toMatchObject({
      status: 400,
      code: 'PAGE_ID_REQUIRED',
    });
  });

  it('lets the creator or page author revoke, and hides the link afterwards', async () => {
    const { service, repo } = setup();
    const created = await service.create(authed(OWNER, { pageId: PAGE }));
    const denied = await rpcError(
      service.revoke(authed(OTHER, { token: created.token })),
    );
    expect(denied).toEqual(UNAVAILABLE);
    expect(repo.rows[0].revokedAt).toBeNull();

    await expect(
      service.revoke(authed(AUTHOR, { token: created.token })),
    ).resolves.toEqual({
      revoked: true,
    });
    expect(repo.rows[0].revokedAt).toBeInstanceOf(Date);
    expect(
      (await service.list(authed(AUTHOR, { pageId: PAGE }))).shares,
    ).toEqual([]);
    expect(
      await rpcError(service.revoke(authed(AUTHOR, { token: created.token }))),
    ).toEqual(UNAVAILABLE);
  });

  it('fails a child read when the parent is revoked, without rewriting the child', async () => {
    const { service, repo } = setup();
    const parent = await service.create(
      authed(OWNER, { pageId: PAGE, allowReshare: true, expiresIn: null }),
    );
    const child = await service.reshare({
      token: parent.token,
      expiresIn: 3600,
      allowReshare: false,
      pageId: OTHER_PAGE,
      _token: 'jwt-secret-do-not-store',
      _session: { accountId: OTHER },
    });
    expect(child).not.toHaveProperty('pageId');
    const childRow = repo.rows.find((row) => row.token === child.token);
    expect(childRow).toMatchObject({
      pageId: PAGE,
      title: '周报',
      body: SOURCE,
      ownerAccountId: OWNER,
      pageOwnerAccountId: AUTHOR,
      createdBy: null,
      parentToken: parent.token,
      allowReshare: false,
    });
    expect(JSON.stringify(childRow)).not.toContain('jwt-secret-do-not-store');

    await service.revoke(authed(OWNER, { token: parent.token }));
    expect(childRow?.revokedAt).toBeNull();
    const viewed = await rpcError(service.view({ token: child.token }));
    const missing = await rpcError(service.view({ token: 'a'.repeat(32) }));
    expect(viewed).toEqual(missing);
    expect(viewed).toEqual(UNAVAILABLE);
  });

  it('uses one public error for a missing link, an expired link, and an expired ancestor', async () => {
    const { service, repo } = setup();
    const parent = await service.create(
      authed(OWNER, { pageId: PAGE, allowReshare: true, expiresIn: 3600 }),
    );
    const child = await service.reshare({
      token: parent.token,
      expiresIn: 120,
      allowReshare: true,
    });
    const parentRow = repo.rows.find((row) => row.token === parent.token);
    if (!parentRow) {
      throw new Error('missing parent');
    }
    parentRow.expiresAt = new Date(Date.now() - 1000);

    const missing = await rpcError(service.view({ token: 'b'.repeat(32) }));
    const expiredSelf = await rpcError(service.view({ token: parent.token }));
    const expiredAncestor = await rpcError(
      service.view({ token: child.token }),
    );
    expect(expiredSelf).toEqual(missing);
    expect(expiredAncestor).toEqual(missing);
    expect(missing).toEqual(UNAVAILABLE);

    const childRow = repo.rows.find((row) => row.token === child.token);
    expect(childRow?.expiresAt && childRow.expiresAt.getTime()).toBeGreaterThan(
      Date.now(),
    );
    expect(childRow?.revokedAt).toBeNull();
  });

  it('rejects reshare when the parent disallows it, and still copies a tighter snapshot when allowed', async () => {
    const { service, findById, repo } = setup();
    const closed = await service.create(
      authed(OWNER, { pageId: PAGE, allowReshare: false, expiresIn: null }),
    );
    findById.mockClear();
    const denied = await rpcError(
      service.reshare({
        token: closed.token,
        expiresIn: 60,
        allowReshare: true,
        pageId: OTHER_PAGE,
      }),
    );
    expect(denied).toEqual({
      status: 403,
      code: 'SHARE_RESHARE_DENIED',
      message: '不允许再分享',
    });
    expect(findById).not.toHaveBeenCalled();
    expect(repo.rows).toHaveLength(1);

    const revoked = await rpcError(
      service.reshare({ token: 'c'.repeat(24), allowReshare: true }),
    );
    expect(revoked).toEqual(UNAVAILABLE);

    await service.revoke(authed(OWNER, { token: closed.token }));
    const afterRevoke = await rpcError(
      service.reshare({
        token: closed.token,
        expiresIn: 60,
        allowReshare: true,
      }),
    );
    expect(afterRevoke).toEqual(UNAVAILABLE);

    const parent = await service.create(
      authed(OWNER, { pageId: PAGE, allowReshare: true, expiresIn: 3600 }),
    );
    const longer = await service.reshare({
      token: parent.token,
      expiresIn: 366 * 24 * 60 * 60,
      allowReshare: true,
    });
    const inherited = await service.reshare({
      token: parent.token,
      expiresIn: null,
      allowReshare: false,
    });
    const parentExpiry = Date.parse(parent.expiresAt ?? '');
    expect(Date.parse(longer.expiresAt ?? '')).toBe(parentExpiry);
    expect(Date.parse(inherited.expiresAt ?? '')).toBe(parentExpiry);
    expect(longer.allowReshare).toBe(true);
    expect(inherited.allowReshare).toBe(false);
    expect(longer).not.toHaveProperty('pageId');

    const open = await service.create(
      authed(OWNER, { pageId: PAGE, allowReshare: true, expiresIn: null }),
    );
    const short = await service.reshare({
      token: open.token,
      expiresIn: 60,
      allowReshare: false,
    });
    const forever = await service.reshare({
      token: open.token,
      expiresIn: null,
      allowReshare: false,
    });
    expect(forever.expiresAt).toBeNull();
    expect(Date.parse(short.expiresAt ?? '') - Date.now()).toBeLessThan(70_000);
    expect(Date.parse(short.expiresAt ?? '') - Date.now()).toBeGreaterThan(
      50_000,
    );

    const viewed = await service.view({ token: short.token });
    const shortRow = repo.rows.find((row) => row.token === short.token);
    expect(viewed).toEqual({
      title: '周报',
      body: SOURCE,
      expiresAt: short.expiresAt,
      allowReshare: false,
      sharedAt: shortRow?.createdAt.toISOString(),
    });
    expect(viewed).not.toHaveProperty('pageId');
  });

  it('stops the parent chain at 16 links', async () => {
    const { service, repo } = setup();
    let token = (
      await service.create(
        authed(OWNER, { pageId: PAGE, allowReshare: true, expiresIn: null }),
      )
    ).token;
    for (let i = 0; i < 15; i += 1) {
      token = (
        await service.reshare({ token, expiresIn: null, allowReshare: true })
      ).token;
    }
    expect(repo.rows).toHaveLength(16);
    await expect(service.view({ token })).resolves.toMatchObject({
      title: '周报',
    });
    expect(
      await rpcError(
        service.reshare({ token, expiresIn: null, allowReshare: true }),
      ),
    ).toEqual(UNAVAILABLE);
    expect(repo.rows).toHaveLength(16);
  });
});
