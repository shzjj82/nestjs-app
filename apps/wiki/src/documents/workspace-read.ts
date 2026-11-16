import { Injectable } from '@nestjs/common';
import { asRecord, optionalString, rpcFail } from '../common/rpc';
import { resolveAppCode } from '../common/app-code';
import type { DocPost } from '../common/shared';
import { DocumentsService } from './documents.service';
import { TeamAccess } from './team-access';

/**
 * 工作区按 id 读取，规则与 GET /wiki/documents/id/:pageId 相同。
 * 私有文：作者或团队成员可读。公开文：非作者不可读。
 */
@Injectable()
export class WorkspaceRead {
  constructor(
    private readonly posts: DocumentsService,
    private readonly teamAccess: TeamAccess,
  ) {}

  async findById(
    payload: Record<string, unknown>,
    pageId: string,
  ): Promise<DocPost> {
    const post = await this.posts.findById(pageId);
    if (!post || post.appCode !== resolveAppCode(payload)) {
      rpcFail(404, 'NOT_FOUND');
    }
    const actorId = authorAccountId(payload);
    const grants = await this.grants(payload);
    const inTeam = Boolean(
      post.teamId && grants.readable.includes(post.teamId),
    );
    if (post.visibility === 'private') {
      if (!actorId || (post.authorId && post.authorId !== actorId && !inTeam)) {
        rpcFail(403, 'FORBIDDEN');
      }
    } else if (actorId && post.authorId && post.authorId !== actorId) {
      rpcFail(403, 'FORBIDDEN');
    }
    return post;
  }

  private async grants(payload: Record<string, unknown>) {
    const accountId = sessionAccountId(payload);
    const appCode = sessionAppCode(payload);
    if (!accountId || !appCode) {
      return { readable: [] as string[], writable: [] as string[] };
    }
    const items = await this.teamAccess.grants({
      accountId,
      appCode,
      bizCode: optionalString(payload._bizCode) ?? appCode,
    });
    return {
      readable: items.map((item) => item.teamId),
      writable: items
        .filter((item) => item.role === 'owner' || item.role === 'developer')
        .map((item) => item.teamId),
    };
  }
}

function authorAccountId(payload: Record<string, unknown>): string | undefined {
  const session = asRecord(payload._session);
  return optionalString(session.accountId) ?? optionalString(payload.authorId);
}

function sessionAccountId(
  payload: Record<string, unknown>,
): string | undefined {
  return optionalString(asRecord(payload._session).accountId);
}

function sessionAppCode(payload: Record<string, unknown>): string | undefined {
  return (
    optionalString(payload._appCode) ??
    optionalString(asRecord(payload._session).appId)
  );
}
