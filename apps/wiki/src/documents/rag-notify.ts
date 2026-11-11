import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { AGENTS_CLIENT, MQTT_PATTERNS } from '@app/common';
import type { DocPost } from '../common/shared';

/** 文档变更后异步通知 agents 重建 / 删除 RAG 索引，不阻塞写路径 */
@Injectable()
export class RagNotify implements OnModuleInit {
  private readonly logger = new Logger('DocsRagNotify');

  constructor(@Inject(AGENTS_CLIENT) private readonly agents: ClientProxy) {}

  async onModuleInit() {
    await this.agents.connect();
  }

  index(post: DocPost) {
    this.agents
      .emit(MQTT_PATTERNS.AGENTS_RAG_INDEX, {
        appCode: post.appCode,
        docId: post.id,
        slug: post.slug,
        title: post.title,
        summary: post.summary,
        body: post.body,
        authorId: post.authorId,
        teamId: post.teamId,
        visibility: post.visibility,
      })
      .subscribe({
        error: (err: unknown) => {
          this.logger.warn(
            `rag index emit failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        },
      });
  }

  remove(docId: string) {
    this.agents.emit(MQTT_PATTERNS.AGENTS_RAG_DELETE, { docId }).subscribe({
      error: (err: unknown) => {
        this.logger.warn(
          `rag delete emit failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      },
    });
  }

  /** 文档更新时去掉的附件：先按 source 清向量，再全量重建 */
  removeSources(keys: string[]) {
    const cleaned = [...new Set(keys.map((item) => item.trim()).filter(Boolean))];
    if (!cleaned.length) {
      return;
    }
    this.agents
      .emit(MQTT_PATTERNS.AGENTS_RAG_DELETE_BY_SOURCE, { keys: cleaned })
      .subscribe({
        error: (err: unknown) => {
          this.logger.warn(
            `rag deleteBySource emit failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        },
      });
  }
}
