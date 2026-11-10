import {
  notifyInternalKey,
  optionalString,
  parseWith,
  requireSessionUserId,
  rpcFail,
  sessionUserId,
  toPage,
} from '@app/common';
import type { NotifyTodoStatus } from '@app/notify-contract';
import { z } from 'zod';

export { toPage };

export interface Actor {
  userId: string;
}

const TOPIC_TOKEN = /^[A-Za-z0-9_-]{1,64}$/;

const topicToken = (label: string) =>
  z
    .string({ required_error: `${label} 必填`, invalid_type_error: `${label} 必填` })
    .trim()
    .min(1, `${label} 必填`)
    .regex(TOPIC_TOKEN, `${label} 只能包含字母、数字、下划线和中划线`);

const uuidSchema = (label: string) =>
  z
    .string({ required_error: `${label} 无效`, invalid_type_error: `${label} 无效` })
    .trim()
    .uuid(`${label} 无效`);

const dueAtSchema = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return value;
}, z.union([
  z.null(),
  z
    .string({ invalid_type_error: 'dueAt 无效' })
    .trim()
    .min(1, 'dueAt 无效')
    .refine((text) => !Number.isNaN(new Date(text).getTime()), 'dueAt 无效')
    .transform((text) => new Date(text)),
]));

const dataObjectSchema = z
  .custom<Record<string, unknown>>(
    (value) => !!value && typeof value === 'object' && !Array.isArray(value),
    { message: 'data 必须是对象' },
  )
  .refine((obj) => JSON.stringify(obj).length <= 8000, 'data 过大');

const dataSchema = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return value;
}, z.union([z.null(), dataObjectSchema]));

const sendSchema = (sourceFallback: string) =>
  z.object({
    bizCode: topicToken('bizCode'),
    userId: topicToken('userId'),
    title: z
      .string({ required_error: 'title 必填且不超过 120 字', invalid_type_error: 'title 必填且不超过 120 字' })
      .trim()
      .min(1, 'title 必填且不超过 120 字')
      .max(120, 'title 必填且不超过 120 字'),
    content: z
      .string({
        required_error: 'content 必填且不超过 4000 字',
        invalid_type_error: 'content 必填且不超过 4000 字',
      })
      .trim()
      .min(1, 'content 必填且不超过 4000 字')
      .max(4000, 'content 必填且不超过 4000 字'),
    category: z.preprocess(
      (value) => optionalString(value) ?? 'system',
      topicToken('category'),
    ),
    source: z.preprocess(
      (value) => optionalString(value) ?? sourceFallback,
      topicToken('source'),
    ),
    data: dataSchema,
    dueAt: dueAtSchema,
  });

export interface SendCommand {
  bizCode: string;
  userId: string;
  title: string;
  content: string;
  category: string;
  source: string;
  data: Record<string, unknown> | null;
  dueAt: Date | null;
}

export function actorOf(payload: Record<string, unknown>): Actor | null {
  const userId = sessionUserId(payload);
  return userId ? { userId } : null;
}

export function requireActor(payload: Record<string, unknown>): Actor {
  return { userId: requireSessionUserId(payload) };
}

export function bizCodeOf(payload: Record<string, unknown>): string {
  const code = optionalString(payload._bizCode);
  if (!code) {
    rpcFail(400, '缺少业务');
  }
  return code;
}

export function requireInternal(payload: Record<string, unknown>): void {
  const key = optionalString(payload._internal);
  if (!key || key !== notifyInternalKey()) {
    rpcFail(403, '内部事件密钥无效');
  }
}

export function requireUuid(value: unknown, label: string): string {
  return parseWith(uuidSchema(label), value);
}

export function unreadOnly(payload: Record<string, unknown>): boolean {
  const value = payload.unread;
  return value === true || value === 1 || value === '1' || value === 'true';
}

export function parseSend(
  payload: Record<string, unknown>,
  sourceFallback: string,
): SendCommand {
  return parseWith(sendSchema(sourceFallback), payload) as SendCommand;
}

const todoStatusSchema = z.enum(['open', 'done', 'cancelled'], {
  errorMap: () => ({ message: 'status 只能是 open、done 或 cancelled' }),
});

export function todoStatusOf(payload: Record<string, unknown>): NotifyTodoStatus | undefined {
  const status = optionalString(payload.status);
  if (!status) {
    return undefined;
  }
  return parseWith(todoStatusSchema, status);
}

export function finishTodo(current: string, action: 'done' | 'cancel'): NotifyTodoStatus {
  if (current !== 'open') {
    rpcFail(409, '待办已结束');
  }
  return action === 'done' ? 'done' : 'cancelled';
}


const updateMineSchema = z.object({
  title: z
    .string({ required_error: 'title 必填且不超过 120 字', invalid_type_error: 'title 必填且不超过 120 字' })
    .trim()
    .min(1, 'title 必填且不超过 120 字')
    .max(120, 'title 必填且不超过 120 字'),
  content: z
    .string({
      required_error: 'content 必填且不超过 4000 字',
      invalid_type_error: 'content 必填且不超过 4000 字',
    })
    .trim()
    .min(1, 'content 必填且不超过 4000 字')
    .max(4000, 'content 必填且不超过 4000 字'),
  category: z.preprocess(
    (value) => optionalString(value) ?? 'system',
    topicToken('category'),
  ),
  data: dataSchema,
  dueAt: dueAtSchema,
});

export type UpdateMineCommand = {
  title: string;
  content: string;
  category: string;
  data: Record<string, unknown> | null;
  dueAt: Date | null;
};

export function parseUpdateMine(payload: Record<string, unknown>): UpdateMineCommand {
  return parseWith(updateMineSchema, payload) as UpdateMineCommand;
}
