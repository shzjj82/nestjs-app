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
import {
  applyStatusTransition,
  normalizeTodoStatus,
  parseStatusFilter,
  resolvePatchStatus,
  type CanonicalTodoStatus,
} from '../todos/todo-status';

export { toPage };
export { parseStatusFilter, normalizeTodoStatus };

export interface Actor {
  userId: string;
}

const TOPIC_TOKEN = /^[A-Za-z0-9_-]{1,64}$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

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

const startsAtSchema = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return value;
}, z.union([
  z.null(),
  z
    .string({ invalid_type_error: 'startsAt 无效' })
    .trim()
    .regex(DATE_ONLY, 'startsAt 须为 YYYY-MM-DD'),
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

const createStatusSchema = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') {
    return 'pending';
  }
  return normalizeTodoStatus(String(value));
}, z.enum(['pending', 'in_progress', 'done', 'cancelled']));

const sendSchema = (sourceFallback: string) =>
  z.object({
    bizCode: topicToken('bizCode'),
    userId: topicToken('userId'),
    title: z
      .string({ required_error: 'title 必填且不超过 120 字', invalid_type_error: 'title 必填且不超过 120 字' })
      .trim()
      .min(1, 'title 必填且不超过 120 字')
      .max(120, 'title 必填且不超过 120 字'),
    content: z.preprocess(
      (value) => (value === undefined || value === null ? '' : value),
      z
        .string({ invalid_type_error: 'content 须为字符串' })
        .trim()
        .max(4000, 'content 不超过 4000 字'),
    ),
    category: z.preprocess(
      (value) => optionalString(value) ?? 'system',
      topicToken('category'),
    ),
    source: z.preprocess(
      (value) => optionalString(value) ?? sourceFallback,
      topicToken('source'),
    ),
    status: createStatusSchema,
    data: dataSchema,
    dueAt: dueAtSchema,
    startsAt: startsAtSchema,
  });

export interface SendCommand {
  bizCode: string;
  userId: string;
  title: string;
  content: string;
  category: string;
  source: string;
  status: CanonicalTodoStatus;
  data: Record<string, unknown> | null;
  dueAt: Date | null;
  startsAt: string | null;
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
  const parsed = parseWith(sendSchema(sourceFallback), payload) as SendCommand;
  if (!parsed.startsAt && parsed.data && typeof parsed.data.start === 'string') {
    const start = parsed.data.start.trim();
    if (DATE_ONLY.test(start)) {
      parsed.startsAt = start;
    }
  }
  // 编辑器兼容：status=open 时细态看 data.localStatus
  if (String(payload.status ?? '') === 'open') {
    parsed.status = resolvePatchStatus('open', parsed.data) ?? 'pending';
  }
  return parsed;
}

/** 单状态过滤（兼容）；多状态请用 parseStatusFilter */
export function todoStatusOf(payload: Record<string, unknown>): NotifyTodoStatus | undefined {
  const list = parseStatusFilter(payload.status);
  if (!list?.length) {
    return undefined;
  }
  return list[0];
}

export function finishTodo(
  current: string,
  action: 'done' | 'cancel',
): CanonicalTodoStatus {
  const next = action === 'done' ? 'done' : 'cancelled';
  return applyStatusTransition({ current, next, startsAt: null }).status;
}

const updateMineSchema = z.object({
  title: z
    .string({ required_error: 'title 必填且不超过 120 字', invalid_type_error: 'title 必填且不超过 120 字' })
    .trim()
    .min(1, 'title 必填且不超过 120 字')
    .max(120, 'title 必填且不超过 120 字'),
  content: z.preprocess((value) => {
    if (value === undefined || value === null) {
      return undefined;
    }
    return value;
  }, z
    .string({ invalid_type_error: 'content 须为字符串' })
    .trim()
    .max(4000, 'content 不超过 4000 字')
    .optional()),
  category: z.preprocess(
    (value) => optionalString(value) ?? 'system',
    topicToken('category'),
  ),
  data: dataSchema,
  dueAt: dueAtSchema,
  startsAt: startsAtSchema.optional(),
  status: z.string().optional(),
});

export type UpdateMineCommand = {
  title: string;
  content?: string;
  category: string;
  data: Record<string, unknown> | null;
  dueAt: Date | null;
  startsAt?: string | null;
  status?: CanonicalTodoStatus;
};

export function parseUpdateMine(payload: Record<string, unknown>): UpdateMineCommand {
  const parsed = parseWith(updateMineSchema, payload) as {
    title: string;
    content?: string;
    category: string;
    data: Record<string, unknown> | null;
    dueAt: Date | null;
    startsAt?: string | null;
    status?: string;
  };
  return {
    title: parsed.title,
    content: parsed.content,
    category: parsed.category,
    data: parsed.data,
    dueAt: parsed.dueAt,
    startsAt: parsed.startsAt,
    status: resolvePatchStatus(parsed.status ?? payload.status, parsed.data),
  };
}
