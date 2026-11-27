import type { AgentRagSource } from '@app/common';

export type ChatTodo = {
  title: string;
  status: string;
  startsAt: string;
  dueAt: string;
  content: string;
};

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

  /** 当前用户的待办。available 为 false 表示列表没有取到。 */
  abstract listTodosForChat(input: {
    payload: unknown;
    status: string;
  }): Promise<{ available: boolean; items: ChatTodo[] }>;
}
