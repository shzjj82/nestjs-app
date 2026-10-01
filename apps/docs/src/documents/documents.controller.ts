import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { ApiDoc, DocsHandleLogInterceptor, MQTT_PATTERNS } from '@app/common';
import {
  asRecord,
  docsPattern,
  optionalString,
  requiredString,
  rpcFail,
} from '../common/rpc';
import { resolveAppCode } from '../common/app-code';
import { isDocKind } from '../common/doc-kinds';
import {
  isEditorJsDocument,
  normalizeTags,
  type EditorJsDocument,
  type DocKind,
} from '../common/shared';
import { DocumentsService } from './documents.service';
import { TeamAccess } from './team-access';
import {
  isTreeView,
  parseVisibility,
  resolveDocsListScope,
  type DocVisibility,
} from './list-scope';

@Controller()
@UseInterceptors(DocsHandleLogInterceptor)
export class DocumentsController {
  constructor(
    private readonly posts: DocumentsService,
    private readonly teamAccess: TeamAccess,
  ) {}

  @MessagePattern(docsPattern(MQTT_PATTERNS.DOC_POST_FIND_ALL))
  @ApiDoc({ name: '文档列表', description: 'scope 支持 public / feed / mine / all' })
  async findAll(payload: Record<string, unknown> = {}) {
    const appCode = resolveAppCode(payload);
    const privileged = payload._docsPrivileged === true;
    const sessionAuthorId = sessionUserId(payload);
    const scope = resolveDocsListScope(payload);
    const tree = isTreeView(payload);

    if (scope === 'mine') {
      // mine 必须用户 JWT；仅 x-docs-key 不能冒充「我的工作区」
      if (!sessionAuthorId) {
        rpcFail(401, 'UNAUTHORIZED');
      }
      const grants = await this.grants(payload);
      const posts = await this.posts.listWorkspaceTree(
        appCode,
        sessionAuthorId,
        grants.readable,
      );
      return { posts, total: posts.length };
    }

    if (scope === 'all') {
      if (!privileged) {
        rpcFail(401, 'UNAUTHORIZED');
      }
      if (tree) {
        // 全量工作区树（迁移/运维）；不按作者过滤
        const posts = await this.posts.listWorkspaceTree(appCode, undefined);
        return { posts, total: posts.length };
      }
      return this.listPage(payload, appCode, { visibilityFilter: 'any' });
    }

    if (scope === 'feed') {
      const grants = await this.grants(payload);
      return this.listPage(payload, appCode, {
        visibilityFilter: 'feed',
        viewerId: sessionAuthorId,
        readableTeamIds: grants.readable,
        authorId: optionalString(payload.authorId),
      });
    }

    // scope=public：已发布广场；结果不因是否带 JWT / docs-key 而变
    return this.listPage(payload, appCode, {
      visibilityFilter: 'public-only',
      authorId: optionalString(payload.authorId),
    });
  }

  @MessagePattern(docsPattern(MQTT_PATTERNS.DOC_POST_FIND_ID))
  @ApiDoc({ name: '按 ID 查看文档', description: '工作区按 id 读取，含祖先链' })
  async findId(payload: Record<string, unknown>) {
    const post = await this.requireInBiz(payload);
    const actorId = sessionUserId(payload);
    const grants = await this.grants(payload);
    const inTeam = Boolean(post.teamId && grants.readable.includes(post.teamId));
    // 私有文：作者或团队成员可读；公开文工作区按 id：非作者也不可读
    if (post.visibility === 'private') {
      if (!actorId || (post.authorId && post.authorId !== actorId && !inTeam)) {
        rpcFail(403, 'FORBIDDEN');
      }
    } else if (actorId && post.authorId && post.authorId !== actorId) {
      rpcFail(403, 'FORBIDDEN');
    }
    return {
      post,
      ancestors: await this.posts.listAncestors(post.id, true),
    };
  }

  @MessagePattern(docsPattern(MQTT_PATTERNS.DOC_POST_FIND_SLUG))
  @ApiDoc({ name: '文档详情', description: '按 slug 读取已发布文档' })
  async findSlug(payload: Record<string, unknown>) {
    const privileged = payload._docsPrivileged === true;
    const sessionAuthorId = sessionUserId(payload);
    const grants = sessionAuthorId
      ? await this.grants(payload)
      : { readable: [] as string[], writable: [] as string[] };
    const forceAny = privileged && payload.mode === 'any';
    const mode: 'public' | 'feed' | 'any' = forceAny
      ? 'any'
      : sessionAuthorId
        ? 'feed'
        : 'public';
    const includePrivate = mode !== 'public';
    const appCode = resolveAppCode(payload);
    const post = await this.posts.findBySlug(
      appCode,
      requiredString(payload.slug, 'slug'),
      { mode, viewerId: sessionAuthorId, readableTeamIds: grants.readable },
    );
    if (!post) {
      rpcFail(404, 'NOT_FOUND');
    }
    const visibilityFilter =
      mode === 'any' ? 'any' : mode === 'feed' ? 'feed' : 'public-only';
    const ancestors = await this.posts.listAncestors(post.id, includePrivate);
    const { posts: siblings } = await this.posts.list({
      appCode: post.appCode,
      docKind: post.kind,
      parentId: post.parentId ?? null,
      visibilityFilter,
      viewerId: sessionAuthorId,
      readableTeamIds: grants.readable,
      treeOrder: true,
    });
    const { posts: children } = await this.posts.list({
      appCode: post.appCode,
      docKind: post.kind,
      parentId: post.id,
      visibilityFilter,
      viewerId: sessionAuthorId,
      readableTeamIds: grants.readable,
      treeOrder: true,
    });
    return {
      post,
      ancestors,
      siblings,
      children: includePrivate
        ? children
        : children.filter((item) => item.visibility === 'public'),
    };
  }

  @MessagePattern(docsPattern(MQTT_PATTERNS.DOC_POST_CREATE))
  @ApiDoc({ name: '创建文档' })
  async create(payload: Record<string, unknown>) {
    const input = this.parseWrite(payload);
    const grants = await this.grants(payload);
    this.assertAssignableTeam(payload, input.teamId, grants.writable);
    return { post: await this.posts.create(input) };
  }

  @MessagePattern(docsPattern(MQTT_PATTERNS.DOC_POST_UPDATE))
  @ApiDoc({ name: '更新文档' })
  async update(payload: Record<string, unknown>) {
    await this.requireInBiz(payload);
    const input = this.parseWrite(payload);
    const grants = await this.grants(payload);
    this.assertAssignableTeam(payload, input.teamId, grants.writable);
    const post = await this.posts.update(
      requiredString(payload.id, 'id'),
      input,
      grants.writable,
    );
    if (!post) {
      rpcFail(404, 'NOT_FOUND');
    }
    return { post };
  }

  @MessagePattern(docsPattern(MQTT_PATTERNS.DOC_POST_DELETE))
  @ApiDoc({ name: '删除文档' })
  async remove(payload: Record<string, unknown>) {
    await this.requireInBiz(payload);
    const grants = await this.grants(payload);
    if (
      !(await this.posts.remove(
        requiredString(payload.id, 'id'),
        sessionUserId(payload),
        grants.writable,
      ))
    ) {
      rpcFail(404, 'NOT_FOUND');
    }
    return null;
  }

  @MessagePattern(docsPattern(MQTT_PATTERNS.DOC_POST_CHILDREN))
  @ApiDoc({ name: '创建子文档' })
  async createChild(payload: Record<string, unknown>) {
    await this.requireInBiz(payload);
    const grants = await this.grants(payload);
    return this.posts.createLinkedChild(
      requiredString(payload.id, 'id'),
      sessionUserId(payload),
      grants.writable,
    );
  }

  @MessagePattern(docsPattern(MQTT_PATTERNS.DOC_POST_REPARENT))
  @ApiDoc({ name: '移动文档', description: '调整父文档与排序' })
  async reparent(payload: Record<string, unknown>) {
    await this.requireInBiz(payload);
    const grants = await this.grants(payload);
    const raw = payload.parentId;
    const parentId = raw === undefined || raw === null ? null : String(raw);
    return this.posts.reparent(
      requiredString(payload.id, 'id'),
      parentId,
      sessionUserId(payload),
      grants.writable,
    );
  }

  /** 按 id 操作的文档必须属于当前业务，否则按不存在处理 */
  private async requireInBiz(payload: Record<string, unknown>) {
    const post = await this.posts.findById(requiredString(payload.id, 'id'));
    if (!post || post.appCode !== resolveAppCode(payload)) {
      rpcFail(404, 'NOT_FOUND');
    }
    return post;
  }

  private async listPage(
    payload: Record<string, unknown>,
    appCode: string,
    opts: {
      visibilityFilter: 'public-only' | 'feed' | 'any';
      viewerId?: string;
      readableTeamIds?: string[];
      authorId?: string;
    },
  ) {
    const docKind =
      typeof payload.kind === 'string' && isDocKind(payload.kind) ? payload.kind : undefined;
    const parentId =
      payload.parentId === 'null' || payload.parentId === null
        ? null
        : optionalString(payload.parentId);
    const { posts, total } = await this.posts.list({
      appCode,
      type: optionalString(payload.type),
      docKind,
      parentId: parentId === undefined ? undefined : parentId,
      limit: Number(payload.limit) || undefined,
      page: Number(payload.page) || undefined,
      pageSize: Number(payload.pageSize) || undefined,
      visibilityFilter: opts.visibilityFilter,
      viewerId: opts.viewerId,
      readableTeamIds: opts.readableTeamIds,
      treeOrder: Boolean(docKind || parentId !== undefined),
      authorId: opts.authorId,
    });
    return {
      posts,
      total,
      page: Number(payload.page) || 1,
      pageSize: Number(payload.pageSize) || posts.length,
    };
  }

  private parseWrite(payload: Record<string, unknown>): {
    appCode: string;
    id?: string;
    title: string;
    slug?: string;
    type: string;
    kind?: DocKind;
    parentId?: string | null;
    treeSort?: number;
    summary: string;
    coverUrl: string;
    props?: Record<string, unknown>;
    tags?: string[];
    body: EditorJsDocument;
    visibility: DocVisibility;
    authorId?: string | null;
    teamId?: string | null;
  } {
    const title = requiredString(payload.title, 'title');
    const body = payload.body;
    if (!isEditorJsDocument(body)) {
      rpcFail(400, 'INVALID_BODY');
    }
    const kind =
      typeof payload.kind === 'string' && isDocKind(payload.kind) ? payload.kind : undefined;
    return {
      appCode: resolveAppCode(payload),
      id: optionalString(payload.id),
      title,
      slug: optionalString(payload.slug),
      type: optionalString(payload.type) ?? '',
      kind,
      parentId:
        payload.parentId === undefined
          ? undefined
          : payload.parentId === null
            ? null
            : String(payload.parentId),
      treeSort: typeof payload.treeSort === 'number' ? payload.treeSort : undefined,
      summary: optionalString(payload.summary) ?? '',
      coverUrl: optionalString(payload.coverUrl) ?? '',
      props: asRecord(payload.props),
      tags: payload.tags === undefined ? undefined : normalizeTags(payload.tags),
      body,
      visibility: parseVisibility(payload.visibility, 'private'),
      authorId: sessionUserId(payload),
      teamId: parseTeamId(payload.teamId),
    };
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
      bizCode: resolveAppCode(payload),
    });
    return {
      readable: items.map((item) => item.teamId),
      writable: items
        .filter((item) => item.role === 'owner' || item.role === 'developer')
        .map((item) => item.teamId),
    };
  }

  /** 登录用户把文档挂到团队时，必须是该团队的拥有者或开发者。服务密钥不带账户时放行。 */
  private assertAssignableTeam(
    payload: Record<string, unknown>,
    teamId: string | null | undefined,
    writable: string[],
  ) {
    if (!teamId || !sessionAccountId(payload)) {
      return;
    }
    if (!writable.includes(teamId)) {
      rpcFail(403, 'FORBIDDEN');
    }
  }
}

function sessionUserId(payload: Record<string, unknown>): string | undefined {
  const session = asRecord(payload._session);
  return optionalString(session.userId) ?? optionalString(payload.authorId);
}

function sessionAccountId(payload: Record<string, unknown>): string | undefined {
  return optionalString(asRecord(payload._session).accountId);
}

function sessionAppCode(payload: Record<string, unknown>): string | undefined {
  return optionalString(asRecord(payload._session).appId);
}

function parseTeamId(raw: unknown): string | null | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (raw === null || raw === '') {
    return null;
  }
  const value = String(raw).trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    rpcFail(400, 'teamId 无效');
  }
  return value;
}
