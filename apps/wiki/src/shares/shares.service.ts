import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { asRecord, optionalString, rpcFail } from '../common/rpc';
import { resolveAppCode } from '../common/app-code';
import type { DocPost, EditorJsDocument } from '../common/shared';
import { DocumentsService } from '../documents/documents.service';
import { WorkspaceRead } from '../documents/workspace-read';
import { WikiShareEntity } from '../entities/wiki-share.entity';

/** 约 2MB。按快照 JSON 的 UTF-8 字节计。 */
export const SHARE_BODY_LIMIT = 2 * 1024 * 1024;
/** 子孙页面层数。再深就不再往下收，避免成环。 */
const SHARE_TREE_LIMIT = 16;
const DAY_SECONDS = 24 * 60 * 60;
const MIN_DAYS = 1;
const MAX_DAYS = 366;
const SHANGHAI = 'Asia/Shanghai';
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;

type ShareNode = {
  id: string;
  title: string;
  body: EditorJsDocument;
  children: ShareNode[];
};

const UNAVAILABLE = {
  status: 404,
  message: '分享链接不可用',
  code: 'SHARE_UNAVAILABLE',
} as const;

@Injectable()
export class SharesService {
  constructor(
    @InjectRepository(WikiShareEntity)
    private readonly shares: Repository<WikiShareEntity>,
    private readonly workspace: WorkspaceRead,
    private readonly posts: DocumentsService,
  ) {}

  async create(payload: Record<string, unknown>) {
    const accountId = requireAccount(payload);
    const pageId = optionalString(payload.pageId);
    if (!pageId || !UUID_RE.test(pageId)) {
      rpcFail(404, '页面不可读', 'PAGE_UNREADABLE');
    }
    const expiresAt = parseExpiresIn(payload.expiresIn);
    const post = await this.readPage(payload, pageId);
    const snapshot = await this.snapshotTree(payload, post);
    if (
      Buffer.byteLength(JSON.stringify(snapshot), 'utf8') > SHARE_BODY_LIMIT
    ) {
      rpcFail(400, '正文过大，无法分享', 'SHARE_TOO_LARGE');
    }
    const row = await this.insert({
      appCode: post.appCode,
      pageId: post.id,
      title: snapshot.title,
      body: snapshot.body,
      children: snapshot.children,
      ownerAccountId: accountId,
      pageOwnerAccountId: post.authorId ?? null,
      createdBy: accountId,
      sharedBy: sharerName(payload),
      expiresAt,
      allowReshare: false,
      parentToken: null,
    });
    return {
      token: row.token,
      urlPath: `/s/${row.token}`,
      pageId: row.pageId,
      title: row.title,
      expiresAt: iso(row.expiresAt),
      sharedBy: row.sharedBy,
    };
  }

  async list(payload: Record<string, unknown>) {
    const accountId = requireAccount(payload);
    const pageId = optionalString(payload.pageId);
    if (!pageId) {
      rpcFail(400, '需要 pageId', 'PAGE_ID_REQUIRED');
    }
    if (!UUID_RE.test(pageId)) {
      return { shares: [] };
    }
    const appCode = resolveAppCode(payload);
    const rows = await this.shares.find({
      where: { appCode, pageId, createdBy: accountId },
    });
    const seen = new Set<string>();
    const shares = rows
      .filter((row) => {
        if (seen.has(row.token)) {
          return false;
        }
        seen.add(row.token);
        return true;
      })
      .sort((a, b) => timeOf(b.createdAt) - timeOf(a.createdAt))
      .map((row) => ({
        token: row.token,
        pageId: row.pageId,
        title: row.title,
        createdAt: iso(row.createdAt) ?? new Date().toISOString(),
        expiresAt: iso(row.expiresAt),
        sharedBy: row.sharedBy,
        parentToken: row.parentToken,
      }));
    return { shares };
  }

  async view(payload: Record<string, unknown>) {
    const row = await this.liveShare(optionalString(payload.token));
    if (!row) {
      unavailable();
    }
    return {
      id: row.pageId,
      title: row.title,
      body: row.body,
      expiresAt: iso(row.expiresAt),
      sharedAt: iso(row.createdAt) ?? new Date().toISOString(),
      sharedBy: row.sharedBy?.trim() || '',
      children: shareNodes(row.children),
    };
  }

  async reshare(payload: Record<string, unknown>) {
    const parent = await this.liveShare(optionalString(payload.token));
    if (!parent) {
      unavailable();
    }
    if (parent.allowReshare !== true) {
      rpcFail(403, '不允许再分享', 'SHARE_RESHARE_DENIED');
    }
    const requested = parseExpiresIn(payload.expiresIn);
    const row = await this.insert({
      appCode: parent.appCode,
      pageId: parent.pageId,
      title: parent.title,
      body: freezeBody(parent.body),
      children: shareNodes(parent.children),
      ownerAccountId: parent.ownerAccountId,
      pageOwnerAccountId: parent.pageOwnerAccountId,
      createdBy: null,
      sharedBy: parent.sharedBy,
      expiresAt: clampExpiry(requested, asDate(parent.expiresAt)),
      allowReshare: parent.allowReshare === true && payload.allowReshare === true,
      parentToken: parent.token,
    });
    return {
      token: row.token,
      urlPath: `/s/${row.token}`,
      title: row.title,
      expiresAt: iso(row.expiresAt),
      allowReshare: row.allowReshare,
    };
  }

  /** 根页面正文保持原样。子孙页面各自成节点，读不到的跳过。 */
  private async snapshotTree(
    payload: Record<string, unknown>,
    post: DocPost,
  ): Promise<ShareNode> {
    const seen = new Set<string>();
    const node = await this.snapshotNode(payload, post, seen, 0);
    if (!node) {
      rpcFail(404, '页面不可读', 'PAGE_UNREADABLE');
    }
    return node;
  }

  private async snapshotNode(
    payload: Record<string, unknown>,
    post: DocPost,
    seen: Set<string>,
    depth: number,
  ): Promise<ShareNode | null> {
    if (seen.has(post.id)) {
      return null;
    }
    seen.add(post.id);
    const children: ShareNode[] = [];
    if (depth < SHARE_TREE_LIMIT) {
      const kids = await this.posts.listChildPosts(post.appCode, post.id);
      for (const kid of kids) {
        if (seen.has(kid.id)) {
          continue;
        }
        let readable: DocPost;
        try {
          readable = await this.readPage(payload, kid.id);
        } catch (err) {
          if (err instanceof RpcException) {
            continue;
          }
          throw err;
        }
        const node = await this.snapshotNode(payload, readable, seen, depth + 1);
        if (node) {
          children.push(node);
        }
      }
    }
    return {
      id: post.id,
      title: post.title.slice(0, 200),
      body: freezeBody(post.body),
      children,
    };
  }

  /** 链接不存在或已过期。不因撤销作废。 */
  private async liveShare(
    token: string | undefined,
  ): Promise<WikiShareEntity | null> {
    if (!token || !TOKEN_RE.test(token)) {
      return null;
    }
    const row = await this.shares.findOne({ where: { token } });
    if (!row || isExpired(row.expiresAt, new Date())) {
      return null;
    }
    return row;
  }

  /**
   * 用调用者登录态走文档按 id 读取。读不到（不存在或无权限）都是 PAGE_UNREADABLE。
   * 不采用请求体里的 authorId / 正文。
   */
  private async readPage(
    payload: Record<string, unknown>,
    pageId: string,
  ): Promise<DocPost> {
    const session = asRecord(payload._session);
    const accountId = optionalString(session.accountId);
    if (!accountId) {
      rpcFail(401, '需要登录', 'UNAUTHORIZED');
    }
    const rest: Record<string, unknown> = { ...payload, id: pageId };
    delete rest.authorId;
    delete rest.body;
    delete rest.title;
    delete rest._token;
    delete rest.accountId;
    delete rest.userId;
    rest._session = { ...session, accountId };
    try {
      const post = await this.workspace.findById(rest, pageId);
      if (!post?.id) {
        rpcFail(404, '页面不可读', 'PAGE_UNREADABLE');
      }
      return post;
    } catch (err) {
      if (err instanceof RpcException) {
        const error = err.getError();
        const code =
          typeof error === 'object' && error !== null
            ? (error as { code?: string }).code
            : undefined;
        if (code === 'PAGE_UNREADABLE') {
          throw err;
        }
        rpcFail(404, '页面不可读', 'PAGE_UNREADABLE');
      }
      throw err;
    }
  }

  private async insert(
    input: Omit<WikiShareEntity, 'token' | 'createdAt' | 'revokedAt'>,
  ): Promise<WikiShareEntity> {
    const row = this.shares.create({
      ...input,
      token: randomBytes(32).toString('base64url'),
      createdAt: new Date(),
      revokedAt: null,
    });
    await this.shares.save(row);
    return row;
  }

  /** 自己或任一祖先缺失、已撤销、已过期，都算这条链接不可用。 */
  private async validChain(
    token: string | undefined,
  ): Promise<WikiShareEntity[] | null> {
    if (!token || !TOKEN_RE.test(token)) {
      return null;
    }
    const now = new Date();
    const chain: WikiShareEntity[] = [];
    const seen = new Set<string>();
    let current: string | null = token;
    while (current) {
      if (seen.has(current) || chain.length >= SHARE_CHAIN_LIMIT) {
        return null;
      }
      seen.add(current);
      if (!TOKEN_RE.test(current)) {
        return null;
      }
      const row = await this.shares.findOne({ where: { token: current } });
      if (!row || row.revokedAt || isExpired(row.expiresAt, now)) {
        return null;
      }
      chain.push(row);
      current = row.parentToken;
    }
    return chain;
  }
}

function sharerName(payload: Record<string, unknown>): string | null {
  const session = asRecord(payload._session);
  const name = optionalString(session.nickname) || optionalString(session.username);
  const trimmed = name?.trim() ?? '';
  return trimmed ? trimmed.slice(0, 80) : null;
}

function requireAccount(payload: Record<string, unknown>): string {
  const accountId = optionalString(asRecord(payload._session).accountId);
  if (!accountId) {
    rpcFail(401, '需要登录', 'UNAUTHORIZED');
  }
  return accountId;
}

function unavailable(): never {
  rpcFail(UNAVAILABLE.status, UNAVAILABLE.message, UNAVAILABLE.code);
}

/** 省略或 null 表示不过期。否则必须是 1 到 366 的整天秒数，到期日当天结束才失效。 */
function parseExpiresIn(value: unknown, now = new Date()): Date | null {
  if (value === undefined || value === null) {
    return null;
  }
  const days = value / DAY_SECONDS;
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    !Number.isInteger(days) ||
    days < MIN_DAYS ||
    days > MAX_DAYS
  ) {
    rpcFail(
      400,
      '有效期须为 1 天到 366 天的整天，或留空表示不过期',
      'INVALID_EXPIRES_IN',
    );
  }
  return endOfShanghaiDay(now, days);
}

/** 创建日算第 1 天。到期日用上海自然日的 23:59:59.999。 */
function endOfShanghaiDay(now: Date, days: number): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SHANGHAI,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const day = Number(parts.find((part) => part.type === 'day')?.value);
  return new Date(Date.UTC(year, month - 1, day + days - 1, 15, 59, 59, 999));
}

/** 父链接有到期时间时，子链接不能更晚；没填则继承父链接。 */
function clampExpiry(
  choice: Date | null,
  parentExpiresAt: Date | null,
): Date | null {
  if (!parentExpiresAt) {
    return choice;
  }
  if (!choice || choice.getTime() > parentExpiresAt.getTime()) {
    return parentExpiresAt;
  }
  return choice;
}

function shareNodes(value: unknown): ShareNode[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    const row = asRecord(item);
    const id = optionalString(row.id);
    if (!id) {
      return [];
    }
    return [
      {
        id,
        title: optionalString(row.title)?.slice(0, 200) ?? '',
        body: freezeBody(row.body),
        children: shareNodes(row.children),
      },
    ];
  });
}

function freezeBody(body: unknown): EditorJsDocument {
  const cloned: unknown = JSON.parse(JSON.stringify(body ?? null)) as unknown;
  if (!cloned || typeof cloned !== 'object' || Array.isArray(cloned)) {
    return { blocks: [] };
  }
  return cloned as EditorJsDocument;
}

function asDate(value: Date | string | null | undefined): Date | null {
  if (value == null) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function timeOf(value: Date | string | null | undefined): number {
  return asDate(value)?.getTime() ?? 0;
}

function isExpired(
  value: Date | string | null | undefined,
  now: Date,
): boolean {
  const date = asDate(value);
  if (!date && value != null) {
    return true;
  }
  return date != null && date.getTime() <= now.getTime();
}

function iso(value: Date | string | null | undefined): string | null {
  return asDate(value)?.toISOString() ?? null;
}
