import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { MQTT_PATTERNS } from '@app/common';
import { HandleLogInterceptor } from '../common/handle-log.interceptor';
import {
  asRecord,
  docsPattern,
  optionalString,
  requiredString,
  rpcFail,
} from '../common/rpc';
import {
  isEditorJsDocument,
  isPageKind,
  normalizeTags,
  type EditorJsDocument,
  type PageKind,
} from '../common/shared';
import { PostsService } from './posts.service';

@Controller()
@UseInterceptors(HandleLogInterceptor)
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @MessagePattern(docsPattern(MQTT_PATTERNS.DOC_POST_FIND_ALL))
  async findAll(payload: Record<string, unknown> = {}) {
    const privileged = payload._docsPrivileged === true;
    const tree =
      payload.tree === '1' || payload.tree === true || payload.tree === 'true';
    const includeDrafts =
      privileged &&
      (payload.includeDrafts === true ||
        payload.includeDrafts === '1' ||
        payload.includeDrafts === 'true' ||
        tree);
    if (tree) {
      if (!privileged) {
        rpcFail(401, 'UNAUTHORIZED');
      }
      const posts = await this.posts.listWorkspaceTree(true);
      return { posts, total: posts.length };
    }
    const pageKind =
      typeof payload.pageKind === 'string' && isPageKind(payload.pageKind)
        ? payload.pageKind
        : undefined;
    const parentId =
      payload.parentId === 'null' || payload.parentId === null
        ? null
        : optionalString(payload.parentId);
    const { posts, total } = await this.posts.list({
      type: optionalString(payload.type),
      kind: payload.kind === 'article' ? 'article' : undefined,
      pageKind,
      parentId: parentId === undefined ? undefined : parentId,
      limit: Number(payload.limit) || undefined,
      page: Number(payload.page) || undefined,
      pageSize: Number(payload.pageSize) || undefined,
      includeDrafts,
      treeOrder: Boolean(pageKind || parentId !== undefined),
    });
    return {
      posts,
      total,
      page: Number(payload.page) || 1,
      pageSize: Number(payload.pageSize) || posts.length,
    };
  }

  @MessagePattern(docsPattern(MQTT_PATTERNS.DOC_POST_SPECIALS))
  async specials() {
    return { about: (await this.posts.findByKind('about')) ?? null };
  }

  @MessagePattern(docsPattern(MQTT_PATTERNS.DOC_POST_FIND_ID))
  async findId(payload: Record<string, unknown>) {
    const post = await this.posts.findById(requiredString(payload.id, 'id'));
    if (!post) {
      rpcFail(404, 'NOT_FOUND');
    }
    return {
      post,
      ancestors: await this.posts.listAncestors(post.id, true),
    };
  }

  @MessagePattern(docsPattern(MQTT_PATTERNS.DOC_POST_FIND_SLUG))
  async findSlug(payload: Record<string, unknown>) {
    const privileged = payload._docsPrivileged === true;
    const includeDrafts =
      privileged &&
      (payload.includeDrafts === true ||
        payload.includeDrafts === '1' ||
        payload.includeDrafts === 'true');
    const post = await this.posts.findBySlug(
      requiredString(payload.slug, 'slug'),
      includeDrafts,
    );
    if (!post || post.pageKind !== 'article') {
      rpcFail(404, 'NOT_FOUND');
    }
    const ancestors = await this.posts.listAncestors(post.id, includeDrafts);
    const { posts: siblings } = await this.posts.list({
      pageKind: 'article',
      parentId: post.parentId ?? null,
      includeDrafts,
      treeOrder: true,
    });
    const { posts: children } = await this.posts.list({
      pageKind: 'article',
      parentId: post.id,
      includeDrafts,
      treeOrder: true,
    });
    return {
      post,
      ancestors,
      siblings,
      children: includeDrafts ? children : children.filter((item) => !item.draft),
    };
  }

  @MessagePattern(docsPattern(MQTT_PATTERNS.DOC_POST_CREATE))
  async create(payload: Record<string, unknown>) {
    return { post: await this.posts.create(this.parseWrite(payload)) };
  }

  @MessagePattern(docsPattern(MQTT_PATTERNS.DOC_POST_UPDATE))
  async update(payload: Record<string, unknown>) {
    const post = await this.posts.update(
      requiredString(payload.id, 'id'),
      this.parseWrite(payload),
    );
    if (!post) {
      rpcFail(404, 'NOT_FOUND');
    }
    return { post };
  }

  @MessagePattern(docsPattern(MQTT_PATTERNS.DOC_POST_DELETE))
  async remove(payload: Record<string, unknown>) {
    if (!(await this.posts.remove(requiredString(payload.id, 'id')))) {
      rpcFail(404, 'NOT_FOUND');
    }
    return null;
  }

  @MessagePattern(docsPattern(MQTT_PATTERNS.DOC_POST_CHILDREN))
  createChild(payload: Record<string, unknown>) {
    return this.posts.createLinkedChild(requiredString(payload.id, 'id'));
  }

  @MessagePattern(docsPattern(MQTT_PATTERNS.DOC_POST_REPARENT))
  reparent(payload: Record<string, unknown>) {
    const raw = payload.parentId;
    const parentId = raw === undefined || raw === null ? null : String(raw);
    return this.posts.reparent(requiredString(payload.id, 'id'), parentId);
  }

  private parseWrite(payload: Record<string, unknown>): {
    id?: string;
    title: string;
    slug?: string;
    type: string;
    pageKind?: PageKind;
    parentId?: string | null;
    treeSort?: number;
    summary: string;
    coverUrl: string;
    props?: Record<string, unknown>;
    tags?: string[];
    body: EditorJsDocument;
    draft: boolean;
  } {
    const title = requiredString(payload.title, 'title');
    const body = payload.body;
    if (!isEditorJsDocument(body)) {
      rpcFail(400, 'INVALID_BODY');
    }
    const pageKind =
      typeof payload.pageKind === 'string' && isPageKind(payload.pageKind)
        ? payload.pageKind
        : undefined;
    return {
      id: optionalString(payload.id),
      title,
      slug: optionalString(payload.slug),
      type: optionalString(payload.type) || 'life',
      pageKind,
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
      draft: payload.draft === false || payload.draft === 'false' ? false : true,
    };
  }
}
