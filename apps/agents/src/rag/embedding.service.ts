import { Injectable, Logger } from '@nestjs/common';
import {
  aiEmbeddingApiBase,
  aiEmbeddingApiKey,
  aiEmbeddingDim,
  aiEmbeddingModel,
  aiTimeoutMs,
  ragConfigured,
} from '../chat/chat-env';
import { rpcFail } from '../common/rpc';

/** 通义 text-embedding-v* 单次 batch 上限 10 */
const EMBED_BATCH_SIZE = 10;

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger('AgentsEmbedding');

  configured(): boolean {
    return ragConfigured();
  }

  model(): string {
    return aiEmbeddingModel();
  }

  dim(): number {
    return aiEmbeddingDim();
  }

  async embed(texts: string[]): Promise<number[][]> {
    const cleaned = texts.map((item) => item.trim()).filter(Boolean);
    if (!cleaned.length) {
      return [];
    }
    if (!this.configured()) {
      rpcFail(503, 'AI_NOT_CONFIGURED');
    }
    const out: number[][] = [];
    for (let i = 0; i < cleaned.length; i += EMBED_BATCH_SIZE) {
      const batch = cleaned.slice(i, i + EMBED_BATCH_SIZE);
      const vectors = await this.embedBatch(batch);
      out.push(...vectors);
    }
    return out;
  }

  async embedOne(text: string): Promise<number[]> {
    const [vec] = await this.embed([text]);
    if (!vec) {
      rpcFail(502, 'AI_EMPTY');
    }
    return vec;
  }

  private async embedBatch(cleaned: string[]): Promise<number[][]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), aiTimeoutMs());
    const dim = aiEmbeddingDim();
    try {
      const res = await fetch(`${aiEmbeddingApiBase()}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${aiEmbeddingApiKey()}`,
        },
        body: JSON.stringify({
          model: aiEmbeddingModel(),
          input: cleaned,
          dimensions: dim,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        this.logger.error(`embedding upstream ${res.status} ${detail.slice(0, 400)}`);
        rpcFail(502, `AI_EMBEDDING_${res.status}`);
      }
      const payload = (await res.json()) as {
        data?: Array<{ embedding?: number[]; index?: number }>;
      };
      const rows = Array.isArray(payload.data) ? payload.data : [];
      const sorted = [...rows].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
      const vectors = sorted.map((row) => row.embedding ?? []);
      if (vectors.length !== cleaned.length) {
        rpcFail(502, `AI_EMBEDDING_COUNT_${vectors.length}_EXPECTED_${cleaned.length}`);
      }
      for (const vec of vectors) {
        if (vec.length !== dim) {
          rpcFail(502, `AI_EMBEDDING_DIM_${vec.length}_EXPECTED_${dim}`);
        }
      }
      return vectors;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        rpcFail(504, 'AI_TIMEOUT');
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}
