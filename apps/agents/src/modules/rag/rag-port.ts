import type { AgentRagSource } from '@app/common';

/** Chat 只依赖此端口，避免单测拉进 TypeORM */
export abstract class RagPort {
  abstract status(): {
    enabled: boolean;
    embeddingModel: string;
    embeddingDim: number;
  };

  abstract searchForChat(input: {
    payload: unknown;
    query: string;
    topK?: number;
  }): Promise<AgentRagSource[]>;
}
