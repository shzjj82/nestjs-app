jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import { RpcException } from '@nestjs/microservices';
import {
  SharesService,
  SHARE_BODY_LIMIT,
} from '../../src/shares/shares.service';
import { WikiShareEntity } from '../../src/entities/wiki-share.entity';
import type { DocPost } from '../../src/common/shared';

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
    _session: {
      accountId,
      userId: 'user-1',
      nickname: '周报作者',
      username: 'owner',
    },
    ...extra,
  };
}

let tokenSeq = 0;
function nextToken(): string {
  tokenSeq += 1;
  return tokenSeq.toString(36).padStart(43, 'a');
}

function share(accountId: string, extra: Record<string, unknown> = {}) {
  return authed(accountId, {
    token: nextToken(),
    expiresIn: 7 * 24 * 60 * 60,
    ...extra,
  });
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

function shanghaiEnd(days: number, now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const day = Number(parts.find((part) => part.type === 'day')?.value);
  return new Date(
    Date.UTC(year, month - 1, day + days - 1, 15, 59, 59, 999),
  ).toISOString();
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
    const listChildPosts = jest.fn(async () => [] as DocPost[]);
    const service = new SharesService(
      repo as never,
      { findById } as never,
      { listChildPosts } as never,
    );
    return { repo, findById, listChildPosts, service };
  }

  it('snapshots the readable page and keeps the editor token', async () => {
    const { service, findById, repo } = setup();
    const token = nextToken();
    const created = await service.create(
      share(OWNER, {
        token,
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
    expect(created.token).toBe(token);
    expect(created.urlPath).toBe(`/s/${token}`);
    expect(created.pageId).toBe(PAGE);
    expect(created.title).toBe('周报');
    expect(created.expiresAt).toBe(shanghaiEnd(7));
    expect(created.sharedBy).toBe('周报作者');

    const arg = findById.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.id).toBe(PAGE);
    expect(arg.authorId).toBeUndefined();
    expect(arg.body).toBeUndefined();
    expect(arg._token).toBeUndefined();
    expect(arg.token).toBeUndefined();
    expect(arg.accountId).toBeUndefined();
    expect((arg._session as { accountId: string }).accountId).toBe(OWNER);

    expect(repo.rows).toHaveLength(1);
    expect(repo.rows[0]).toMatchObject({
      token,
      pageId: PAGE,
      title: '周报',
      body: SOURCE,
      ownerAccountId: OWNER,
      pageOwnerAccountId: AUTHOR,
      createdBy: OWNER,
      sharedBy: '周报作者',
      allowReshare: false,
      parentToken: null,
      children: [],
      revokedAt: null,
    });
    expect(JSON.stringify(repo.rows[0])).not.toContain(
      'jwt-secret-do-not-store',
    );
    expect(repo.rows[0]).not.toHaveProperty('_token');
  });

  it('accepts only 1, 7, or 30 days and stores that editor token', async () => {
    const { service, findById, repo } = setup();
    const invalid = {
      status: 400,
      code: 'INVALID_EXPIRES_IN',
      message: '有效期须为 1 天、7 天或 30 天',
    };
    for (const expiresIn of [undefined, null, 59, 366 * 86_400, '604800', 60.5, 2 * 86_400]) {
      expect(
        await rpcError(
          service.create(share(OWNER, { pageId: PAGE, expiresIn })),
        ),
      ).toEqual(invalid);
    }
    const badToken = await rpcError(
      service.create(share(OWNER, { pageId: PAGE, token: 'short' })),
    );
    expect(badToken).toEqual({
      status: 400,
      code: 'SHARE_TOKEN_INVALID',
      message: '分享标识无效',
    });
    expect(findById).not.toHaveBeenCalled();
    expect(repo.rows).toHaveLength(0);

    const day = await service.create(
      share(OWNER, { pageId: PAGE, expiresIn: 86_400 }),
    );
    const week = await service.create(
      share(OWNER, { pageId: PAGE, expiresIn: 7 * 86_400 }),
    );
    const month = await service.create(
      share(OWNER, { pageId: PAGE, expiresIn: 30 * 86_400 }),
    );
    expect(day.expiresAt).toBe(shanghaiEnd(1));
    expect(week.expiresAt).toBe(shanghaiEnd(7));
    expect(month.expiresAt).toBe(shanghaiEnd(30));

    const taken = await rpcError(
      service.create(share(OWNER, { pageId: PAGE, token: day.token })),
    );
    expect(taken).toEqual({
      status: 409,
      code: 'SHARE_TOKEN_TAKEN',
      message: '分享标识已被占用',
    });
  });

  it('maps missing and forbidden documents to the same PAGE_UNREADABLE', async () => {
    const { service, findById, repo } = setup();
    findById.mockRejectedValueOnce(
      new RpcException({ status: 404, message: 'NOT_FOUND' }),
    );
    const missing = await rpcError(
      service.create(share(OWNER, { pageId: PAGE })),
    );
    findById.mockRejectedValueOnce(
      new RpcException({ status: 403, message: 'FORBIDDEN' }),
    );
    const forbidden = await rpcError(
      service.create(share(OWNER, { pageId: PAGE })),
    );
    const unreadable = {
      status: 404,
      code: 'PAGE_UNREADABLE',
      message: '页面不可读',
    };
    expect(missing).toEqual(unreadable);
    expect(forbidden).toEqual(unreadable);
    expect(repo.rows).toHaveLength(0);

    const blank = await rpcError(service.create(share(OWNER, {})));
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
      service.create(share(OWNER, { pageId: PAGE, expiresIn: 86_400 })),
    );
    expect(error).toEqual({
      status: 400,
      code: 'SHARE_TOO_LARGE',
      message: '正文过大，无法分享',
    });
    expect(repo.rows).toHaveLength(0);
  });

  it('lists only links the caller issued on that page, without the body', async () => {
    const { service } = setup();
    const mine = await service.create(share(OWNER, { pageId: PAGE }));
    const authors = await service.create(
      share(AUTHOR, { pageId: PAGE, expiresIn: 86_400 }),
    );
    await service.create(share(OWNER, { pageId: OTHER_PAGE }));
    const later = await service.create(share(OWNER, { pageId: PAGE }));

    const asOwner = await service.list(authed(OWNER, { pageId: PAGE }));
    expect(asOwner.shares.map((item) => item.token).sort()).toEqual(
      [later.token, mine.token].sort(),
    );
    expect(asOwner.shares[0]).not.toHaveProperty('body');
    expect(asOwner.shares[1]).toMatchObject({
      pageId: PAGE,
      title: '周报',
      parentToken: null,
      sharedBy: '周报作者',
    });
    expect(asOwner.shares.every((item) => item.expiresAt)).toBe(true);

    const asAuthor = await service.list(authed(AUTHOR, { pageId: PAGE }));
    expect(asAuthor.shares.map((item) => item.token)).toEqual([authors.token]);

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

  it('keeps each page body and stores descendants beside it', async () => {
    const linked = '11111111-1111-4111-8111-111111111111';
    const loose = '22222222-2222-4222-8222-222222222222';
    const { service, findById, listChildPosts, repo } = setup();
    const parentBody = {
      blocks: [
        { type: 'header', data: { text: '周报', level: 1 } },
        { type: 'pageLink', data: { pageId: linked, title: '子页' } },
        { type: 'paragraph', data: { text: '父页正文' } },
      ],
    };
    const linkedBody = {
      blocks: [
        { type: 'header', data: { text: '子页', level: 1 } },
        { type: 'paragraph', data: { text: '子页正文' } },
      ],
    };
    const looseBody = { blocks: [{ type: 'paragraph', data: { text: '补上的子页' } }] };
    findById.mockImplementation((_payload: unknown, pageId: string) => {
      if (pageId === linked) {
        return { ...post, id: linked, title: '子页', body: linkedBody };
      }
      if (pageId === loose) {
        return { ...post, id: loose, title: '未链接', body: looseBody };
      }
      return { ...post, id: pageId, body: parentBody };
    });
    listChildPosts.mockImplementation(async (_appCode: string, parentId: string) =>
      parentId === PAGE
        ? [
      {
        id: linked,
        appCode: 'wiki',
        title: '子页',
        body: {
          blocks: [
            { type: 'header', data: { text: '子页', level: 1 } },
            { type: 'paragraph', data: { text: '子页正文' } },
          ],
        },
      },
      {
        id: loose,
        appCode: 'wiki',
        title: '未链接',
        body: { blocks: [{ type: 'paragraph', data: { text: '补上的子页' } }] },
      },
        ]
        : [],
    );
    const created = await service.create(share(OWNER, { pageId: PAGE }));
    expect(repo.rows[0].body).toEqual(parentBody);
    expect(repo.rows[0].children).toEqual([
      { id: linked, title: '子页', body: linkedBody, children: [] },
      { id: loose, title: '未链接', body: looseBody, children: [] },
    ]);
    const viewed = await service.view({ token: created.token });
    expect(viewed).toMatchObject({
      id: PAGE,
      children: [
        { id: linked, title: '子页' },
        { id: loose, title: '未链接' },
      ],
    });
    expect(JSON.stringify(viewed)).not.toContain('accountId');
  });

  it('names the sharer on the public page and keeps the page id for in-share navigation', async () => {
    const { service, repo } = setup();
    const created = await service.create(
      share(OWNER, { pageId: PAGE, expiresIn: 86_400 }),
    );
    const row = repo.rows[0];
    const viewed = await service.view({ token: created.token });
    expect(viewed).toEqual({
      id: PAGE,
      title: '周报',
      body: SOURCE,
      expiresAt: created.expiresAt,
      sharedAt: row.createdAt.toISOString(),
      sharedBy: '周报作者',
      children: [],
    });
    expect(viewed).not.toHaveProperty('allowReshare');
  });

  it('uses one public error for a missing link and an expired link', async () => {
    const { service, repo } = setup();
    const created = await service.create(
      share(OWNER, { pageId: PAGE, expiresIn: 86_400 }),
    );
    repo.rows[0].expiresAt = new Date(Date.now() - 1000);
    const missing = await rpcError(service.view({ token: 'b'.repeat(43) }));
    const expired = await rpcError(service.view({ token: created.token }));
    expect(expired).toEqual(missing);
    expect(missing).toEqual(UNAVAILABLE);
  });

  it('copies an old reshare without a new page id and refuses one that is not allowed', async () => {
    const { service, repo } = setup();
    const closed = await service.create(share(OWNER, { pageId: PAGE }));
    expect(
      await rpcError(
        service.reshare({ token: closed.token, expiresIn: 86_400, allowReshare: true }),
      ),
    ).toEqual({
      status: 403,
      code: 'SHARE_RESHARE_DENIED',
      message: '不允许再分享',
    });

    repo.rows[0].allowReshare = true;
    const child = await service.reshare({
      token: closed.token,
      expiresIn: null,
      allowReshare: true,
      pageId: OTHER_PAGE,
    });
    expect(child.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(child.token).not.toBe(closed.token);
    expect(child).not.toHaveProperty('pageId');
    expect(child.allowReshare).toBe(true);
    expect(repo.rows.find((row) => row.token === child.token)).toMatchObject({
      pageId: PAGE,
      body: SOURCE,
      createdBy: null,
      parentToken: closed.token,
    });
  });
});
