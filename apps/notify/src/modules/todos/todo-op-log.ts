import { Logger } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { asRecord, optionalString, sessionUserId } from '@app/common';
import { TodoEventEntity } from '../../entities';

const logger = new Logger('TodoOpLog');

export type TodoOpWrite = {
  bizCode: string;
  todoId: string;
  action: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  actorId?: string | null;
  title?: string | null;
  outcome?: string;
  payload?: Record<string, unknown>;
};

export async function writeTodoOp(
  events: Repository<TodoEventEntity>,
  input: TodoOpWrite,
): Promise<void> {
  try {
    await events.save(
      events.create({
        bizCode: input.bizCode,
        todoId: input.todoId,
        action: input.action,
        fromStatus: input.fromStatus ?? null,
        toStatus: input.toStatus ?? null,
        actorId: input.actorId ?? null,
        title: input.title ?? null,
        outcome: input.outcome ?? 'success',
        payload: input.payload ?? {},
      }),
    );
  } catch (err) {
    logger.warn(
      `写待办操作日志失败 ${input.action}/${input.todoId}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}

export function actorIdFromPayload(payload: Record<string, unknown>): string | null {
  return (
    sessionUserId(payload) ??
    optionalString(asRecord(payload._session).userId) ??
    null
  );
}
