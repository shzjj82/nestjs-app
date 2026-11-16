import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { IsNull, Repository } from 'typeorm';
import { asRecord, optionalString, rpcFail } from '../common/rpc';
import { resolveAppCode } from '../common/app-code';
import type { DocPost } from '../common/shared';
import { WorkspaceRead } from '../documents/workspace-read';
import { WikiShareEntity } from '../entities/wiki-share.entity';

/** 约 2MB。按快照 JSON 的 UTF-8 字节计。 */
export const SHARE_BODY_LIMIT = 2 * 1024 * 1024;
/** 含自身在内的父链层数。再往上视为不可用，避免成环或过深链接。 */
const SHARE_CHAIN_LIMIT = 16;
const MIN_EXPIRES_IN = 60;
const MAX_EXPIRES_IN = 366 * 24 * 60 * 60;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;

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
  ) {}

  async create(payload: Record<string, unknown>) {
    const accountId = requireAccount(payload);
    const pageId = optionalString(payload.pageId);
    if (!pageId || !UUID_RE.test(pageId)) {
      rpcFail(404, '页面不可读', 'PAGE_UNREADABLE');
    }
    const expiresAt = parseExpiresIn(payload.expiresIn);
    const post = await this.readPage(payload, pageId);
    const body = freezeBody(post.body);
    if (Buffer.byteLength(JSON.stringify(body), 'utf8') > SHARE_BODY_LIMIT) {
      rpcFail(400, '正文过大，无法分享', 'SHARE_TOO_LARGE');
    }
    const row = await this.insert({
      appCode: post.appCode,
      pageId: post.id,
      title: post.title.slice(0, 200),
      body,
      ownerAccountId: accountId,
      pageOwnerAccountId: post.authorId ?? null,
      createdBy: accountId,
      expiresAt,
      allowReshare: payload.allowReshare === true,
      parentToken: null,
    });
    return {
      token: row.token,
      urlPath: `/s/${row.token}`,
      pageId: row.pageId,
      title: row.title,
      expiresAt: iso(row.expiresAt),
      allowReshare: row.allowReshare,
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
      where: [
        { appCode, pageId, revokedAt: IsNull(), ownerAccountId: accountId },
        { appCode, pageId, revokedAt: IsNull(), pageOwnerAccountId: accountId },
        { appCode, pageId, revokedAt: IsNull(), createdBy: accountId },
      ],
    });
    const seen = new Set<string>();
    const shares = rows
      .filter((row) => {
        if (seen.has(row.token) || !canManage(row, accountId)) {
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
        allowReshare: row.allowReshare,
        parentToken: row.parentToken,
      }));
    return { shares };
  }

  async revoke(payload: Record<string, unknown>) {
    const accountId = requireAccount(payload);
    const token = optionalString(payload.token);
    if (!token || !TOKEN_RE.test(token)) {
      unavailable();
    }
    const appCode = resolveAppCode(payload);
    const row = await this.shares.findOne({ where: { token } });
    if (
      !row ||
      row.appCode !== appCode ||
      row.revokedAt ||
      !canManage(row, accountId)
    ) {
      unavailable();
    }
    row.revokedAt = new Date();
    await this.shares.save(row);
    return { revoked: true };
  }

  async view(payload: Record<string, unknown>) {
    const chain = await this.validChain(optionalString(payload.token));
    if (!chain) {
      unavailable();
    }
    const row = chain[0];
    return {
      title: row.title,
      body: row.body,
      expiresAt: iso(row.expiresAt),
      allowReshare: row.allowReshare,
      sharedAt: iso(row.createdAt) ?? new Date().toISOString(),
    };
  }

  async reshare(payload: Record<string, unknown>) {
    const chain = await this.validChain(optionalString(payload.token));
    if (!chain) {
      unavailable();
    }
    const parent = chain[0];
    if (parent.allowReshare !== true) {
      rpcFail(403, '不允许再分享', 'SHARE_RESHARE_DENIED');
    }
    if (chain.length >= SHARE_CHAIN_LIMIT) {
      unavailable();
    }
    const requested = parseExpiresIn(payload.expiresIn);
    const row = await this.insert({
      appCode: parent.appCode,
      pageId: parent.pageId,
      title: parent.title,
      body: freezeBody(parent.body),
      ownerAccountId: parent.ownerAccountId,
      pageOwnerAccountId: parent.pageOwnerAccountId,
      createdBy: null,
      expiresAt: clampExpiry(requested, asDate(parent.expiresAt)),
      allowReshare: payload.allowReshare === true,
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

function requireAccount(payload: Record<string, unknown>): string {
  const accountId = optionalString(asRecord(payload._session).accountId);
  if (!accountId) {
    rpcFail(401, '需要登录', 'UNAUTHORIZED');
  }
  return accountId;
}

function canManage(row: WikiShareEntity, accountId: string): boolean {
  return (
    row.ownerAccountId === accountId ||
    row.pageOwnerAccountId === accountId ||
    row.createdBy === accountId
  );
}

function unavailable(): never {
  rpcFail(UNAVAILABLE.status, UNAVAILABLE.message, UNAVAILABLE.code);
}

/** 省略或 null 表示不过期；否则必须是 60 秒到 366 天的整数秒。 */
function parseExpiresIn(value: unknown, now = new Date()): Date | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < MIN_EXPIRES_IN ||
    value > MAX_EXPIRES_IN
  ) {
    rpcFail(
      400,
      '有效期须为 60 秒到 366 天的整数秒，或留空表示不过期',
      'INVALID_EXPIRES_IN',
    );
  }
  return new Date(now.getTime() + value * 1000);
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

function freezeBody(body: unknown): Record<string, unknown> {
  const cloned: unknown = JSON.parse(JSON.stringify(body ?? null)) as unknown;
  if (!cloned || typeof cloned !== 'object' || Array.isArray(cloned)) {
    return { blocks: [] };
  }
  return cloned as Record<string, unknown>;
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
