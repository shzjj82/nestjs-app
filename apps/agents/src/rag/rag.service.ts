import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { lastValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { DataSource } from 'typeorm';
import {
  MQTT_PATTERNS,
  USER_CLIENT,
  type AgentRagSource,
} from '@app/common';
import { asRecord, optionalString, requiredString, rpcFail } from '../common/rpc';
import { requireBizCode } from '../common/biz-scope';
import { extractAttachmentTexts } from './attachment-text';
import { chunkText } from './chunk';
import {
  editorJsAttachments,
  editorJsToText,
  editorJsUnresolvedAttachments,
  resolvePublicFileUrl,
} from './editorjs-text';
import { EmbeddingService } from './embedding.service';
import { RagPort } from './rag-port';

type IndexPayload = {
  appCode: string;
  docId: string;
  slug: string;
  title: string;
  summary: string;
  body: unknown;
  authorId: string | null;
  teamId: string | null;
  visibility: 'private' | 'public';
};

@Injectable()
export class RagService extends RagPort implements OnModuleInit {
  private readonly logger = new Logger('AgentsRag');

  constructor(
    private readonly embedding: EmbeddingService,
    @InjectDataSource() private readonly db: DataSource,
    @Inject(USER_CLIENT) private readonly users: ClientProxy,
  ) {
    super();
  }

  async onModuleInit() {
    await this.users.connect();
  }

  status() {
    return {
      enabled: this.embedding.configured(),
      embeddingModel: this.embedding.model(),
      embeddingDim: this.embedding.dim(),
    };
  }

  async indexDocument(payload: unknown): Promise<{ chunks: number }> {
    const input = parseIndexPayload(payload);
    if (!this.embedding.configured()) {
      this.logger.warn(`skip index ${input.docId}: AI_NOT_CONFIGURED`);
      return { chunks: 0 };
    }

    const bodyText = editorJsToText(input.body, input.title, input.summary);
    const attachments = editorJsAttachments(input.body);
    const unresolved = editorJsUnresolvedAttachments(input.body);
    if (unresolved.length) {
      this.logger.warn(
        `doc ${input.docId} skip attachments without public url: ${unresolved.join(', ')}`,
      );
    }
    const attachmentTexts = await extractAttachmentTexts(attachments);

    const pieces: Array<{ sourceType: string; sourceKey: string | null; text: string }> = [];
    if (bodyText) {
      pieces.push({ sourceType: 'editorjs', sourceKey: null, text: bodyText });
    }
    for (const file of attachmentTexts) {
      pieces.push({
        sourceType: file.ext,
        sourceKey: file.url,
        text: `【附件：${file.name}】\n${file.text}`,
      });
    }

    const prepared: Array<{
      sourceType: string;
      sourceKey: string | null;
      chunkIndex: number;
      content: string;
    }> = [];
    for (const piece of pieces) {
      const chunks = chunkText(piece.text);
      chunks.forEach((content, chunkIndex) => {
        prepared.push({
          sourceType: piece.sourceType,
          sourceKey: piece.sourceKey,
          chunkIndex,
          content,
        });
      });
    }

    if (!prepared.length) {
      await this.deleteByDocId(input.docId);
      return { chunks: 0 };
    }

    // 先算向量，成功后再覆盖旧索引，避免 embedding 失败把库清空
    const vectors = await this.embedding.embed(prepared.map((item) => item.content));
    await this.deleteByDocId(input.docId);
    const now = new Date();
    for (let i = 0; i < prepared.length; i += 1) {
      const item = prepared[i]!;
      const vec = vectors[i];
      if (!vec) {
        continue;
      }
      await this.db.query(
        `
        INSERT INTO ag_rag_chunks (
          id, app_code, author_id, team_id, visibility, doc_id, slug, title,
          source_type, source_key, chunk_index, content, embedding, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13::vector, $14, $14
        )
        `,
        [
          randomUUID(),
          input.appCode,
          input.authorId,
          input.teamId,
          input.visibility,
          input.docId,
          input.slug,
          input.title,
          item.sourceType,
          item.sourceKey,
          item.chunkIndex,
          item.content,
          toVectorLiteral(vec),
          now,
        ],
      );
    }
    this.logger.log(`indexed doc ${input.docId} chunks=${prepared.length}`);
    return { chunks: prepared.length };
  }

  async deleteByDocId(docId: string): Promise<{ deleted: number }> {
    const result = await this.db.query(`DELETE FROM ag_rag_chunks WHERE doc_id = $1`, [docId]);
    const deleted = Number(Array.isArray(result) ? result[1] : 0);
    return { deleted: Number.isFinite(deleted) ? deleted : 0 };
  }

  async deleteFromPayload(payload: unknown): Promise<{ deleted: number }> {
    const data = asRecord(payload);
    const docId = requiredString(data.docId ?? data.id, 'docId');
    return this.deleteByDocId(docId);
  }

  /** 按附件 URL / OSS key 删除对应向量（文档删附件或 upload 删对象时） */
  async deleteBySource(payload: unknown): Promise<{ deleted: number }> {
    const data = asRecord(payload);
    const refs = [
      optionalString(data.url),
      optionalString(data.key),
      optionalString(data.sourceKey),
      ...(Array.isArray(data.keys)
        ? data.keys.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
        : []),
    ].filter((item): item is string => Boolean(item));

    const expanded = new Set<string>();
    for (const ref of refs) {
      expanded.add(ref);
      const resolved = resolveSourceUrl(ref);
      if (resolved) {
        expanded.add(resolved);
      }
    }
    if (!expanded.size) {
      return { deleted: 0 };
    }

    const list = [...expanded];
    const result = await this.db.query(
      `
      DELETE FROM ag_rag_chunks
      WHERE source_key = ANY($1::text[])
         OR EXISTS (
           SELECT 1 FROM unnest($1::text[]) AS ref(val)
           WHERE source_key LIKE '%' || ref.val
         )
      `,
      [list],
    );
    const deleted = Number(Array.isArray(result) ? result[1] : 0);
    const count = Number.isFinite(deleted) ? deleted : 0;
    if (count > 0) {
      this.logger.log(`deleted chunks by source refs=${list.length} deleted=${count}`);
    }
    return { deleted: count };
  }

  async search(payload: unknown): Promise<{ items: AgentRagSource[] }> {
    if (!this.embedding.configured()) {
      rpcFail(503, 'AI_NOT_CONFIGURED');
    }
    const appCode = requireBizCode(payload);
    const accountId = sessionAccountId(payload);
    if (!accountId) {
      rpcFail(401, '请使用账户登录后再检索');
    }
    const data = asRecord(payload);
    const query = requiredString(data.query, 'query').slice(0, 2000);
    const topK = clampInt(data.topK, 1, 20, 6);
    const mineOnly = data.mineOnly === true;
    const teamIds = mineOnly
      ? []
      : await this.readableTeamIds({
          accountId,
          appCode,
          bizCode: appCode,
        });

    const vector = await this.embedding.embedOne(query);
    const params: unknown[] = [toVectorLiteral(vector), appCode, accountId, topK];
    let visibilitySql: string;
    if (mineOnly) {
      visibilitySql = `author_id = $3`;
    } else if (teamIds.length) {
      params.push(teamIds);
      visibilitySql = `(visibility = 'public' OR author_id = $3 OR team_id = ANY($5::uuid[]))`;
    } else {
      visibilitySql = `(visibility = 'public' OR author_id = $3)`;
    }

    const rows = (await this.db.query(
      `
      SELECT
        doc_id AS "docId",
        title,
        slug,
        chunk_index AS "chunkIndex",
        content,
        source_type AS "sourceType",
        1 - (embedding <=> $1::vector) AS score
      FROM ag_rag_chunks
      WHERE app_code = $2
        AND ${visibilitySql}
      ORDER BY embedding <=> $1::vector
      LIMIT $4
      `,
      params,
    )) as Array<{
      docId: string;
      title: string;
      slug: string;
      chunkIndex: number;
      content: string;
      sourceType: string;
      score: number;
    }>;

    return {
      items: rows.map((row) => ({
        docId: row.docId,
        title: row.title ?? '',
        slug: row.slug ?? '',
        chunkIndex: Number(row.chunkIndex) || 0,
        content: String(row.content ?? '').slice(0, 2000),
        score: Number(row.score) || 0,
        sourceType: row.sourceType ?? 'editorjs',
      })),
    };
  }

  async searchForChat(input: {
    payload: unknown;
    query: string;
    topK?: number;
  }): Promise<AgentRagSource[]> {
    if (!this.embedding.configured()) {
      return [];
    }
    try {
      const result = await this.search({
        ...asRecord(input.payload),
        query: input.query,
        topK: input.topK ?? 6,
      });
      return result.items;
    } catch (err) {
      this.logger.warn(
        `chat rag search failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return [];
    }
  }

  private async readableTeamIds(input: {
    accountId: string;
    appCode: string;
    bizCode: string;
  }): Promise<string[]> {
    try {
      const raw = await lastValueFrom(
        this.users
          .send<{ items?: Array<{ teamId?: string }> }>(MQTT_PATTERNS.TEAM_MEMBERSHIPS, input)
          .pipe(timeout(8000)),
      );
      return (raw?.items ?? [])
        .map((item) => optionalString(item.teamId))
        .filter((id): id is string => Boolean(id));
    } catch {
      return [];
    }
  }
}

function parseIndexPayload(payload: unknown): IndexPayload {
  const data = asRecord(payload);
  const visibility = data.visibility === 'public' ? 'public' : 'private';
  return {
    appCode: requiredString(data.appCode ?? data._bizCode ?? data._appCode, 'appCode'),
    docId: requiredString(data.docId ?? data.id, 'docId'),
    slug: optionalString(data.slug) ?? '',
    title: optionalString(data.title) ?? '',
    summary: optionalString(data.summary) ?? '',
    body: data.body ?? { blocks: [] },
    authorId: optionalString(data.authorId) ?? null,
    teamId: optionalString(data.teamId) ?? null,
    visibility,
  };
}

function sessionAccountId(payload: unknown): string | undefined {
  return optionalString(asRecord(asRecord(payload)._session).accountId);
}

function clampInt(raw: unknown, min: number, max: number, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function toVectorLiteral(values: number[]): string {
  return `[${values.join(',')}]`;
}

function resolveSourceUrl(ref: string): string {
  return resolvePublicFileUrl(ref);
}
