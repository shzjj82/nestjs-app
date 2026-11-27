import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { AGENTS_CLIENT, MQTT_PATTERNS } from '@app/common';

/** OSS 删对象后通知 agents 按 source_key 清向量 */
@Injectable()
export class RagNotify implements OnModuleInit {
  private readonly logger = new Logger('UploadRagNotify');

  constructor(@Inject(AGENTS_CLIENT) private readonly agents: ClientProxy) {}

  async onModuleInit() {
    await this.agents.connect();
  }

  removeSource(key: string) {
    const cleaned = key.trim();
    if (!cleaned) {
      return;
    }
    this.agents
      .emit(MQTT_PATTERNS.AGENTS_RAG_DELETE_BY_SOURCE, { key: cleaned })
      .subscribe({
        error: (err: unknown) => {
          this.logger.warn(
            `rag deleteBySource emit failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        },
      });
  }
}
