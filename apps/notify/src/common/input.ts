import {
  notifyInternalKey,
  optionalString,
  requireSessionUserId,
  rpcFail,
  sessionUserId,
  toPage,
} from '@app/common';
import type { NotifyTodoStatus } from '@app/notify-contract';

export { toPage };

export interface Actor {
  userId: string;
}

const TOPIC_TOKEN = /^[A-Za-z0-9_-]{1,64}$/;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  const id = optionalString(value);
  if (!id || !UUID.test(id)) {
    rpcFail(400, `${label} 无效`);
  }
  return id;
}

export function unreadOnly(payload: Record<string, unknown>): boolean {
  const value = payload.unread;
  return value === true || value === 1 || value === '1' || value === 'true';
}

export function parseSend(
  payload: Record<string, unknown>,
  sourceFallback: string,
): SendCommand {
  const bizCode = optionalString(payload.bizCode);
  const userId = optionalString(payload.userId);
  const title = optionalString(payload.title);
  const content = optionalString(payload.content);
  if (!bizCode || !TOPIC_TOKEN.test(bizCode)) {
    rpcFail(400, 'bizCode 只能包含字母、数字、下划线和中划线');
  }
  if (!userId || !TOPIC_TOKEN.test(userId)) {
    rpcFail(400, 'userId 只能包含字母、数字、下划线和中划线');
  }
  if (!title || title.length > 120) {
    rpcFail(400, 'title 必填且不超过 120 字');
  }
  if (!content || content.length > 4000) {
    rpcFail(400, 'content 必填且不超过 4000 字');
  }
  const category = optionalString(payload.category) ?? 'system';
  const source = optionalString(payload.source) ?? sourceFallback;
  if (!TOPIC_TOKEN.test(category) || !TOPIC_TOKEN.test(source)) {
    rpcFail(400, 'category / source 只能包含字母、数字、下划线和中划线');
  }
  return {
    bizCode,
    userId,
    title,
    content,
    category,
    source,
    data: parseData(payload.data),
    dueAt: parseDueAt(payload.dueAt),
  };
}

export function todoStatusOf(payload: Record<string, unknown>): NotifyTodoStatus | undefined {
  const status = optionalString(payload.status);
  if (!status) {
    return undefined;
  }
  if (status !== 'open' && status !== 'done' && status !== 'cancelled') {
    rpcFail(400, 'status 只能是 open、done 或 cancelled');
  }
  return status;
}

export function finishTodo(current: string, action: 'done' | 'cancel'): NotifyTodoStatus {
  if (current !== 'open') {
    rpcFail(409, '待办已结束');
  }
  return action === 'done' ? 'done' : 'cancelled';
}

function parseDueAt(value: unknown): Date | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const text = optionalString(value);
  if (!text) {
    rpcFail(400, 'dueAt 无效');
  }
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    rpcFail(400, 'dueAt 无效');
  }
  return date;
}

function parseData(value: unknown): Record<string, unknown> | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    rpcFail(400, 'data 必须是对象');
  }
  const encoded = JSON.stringify(value);
  if (encoded.length > 8000) {
    rpcFail(400, 'data 过大');
  }
  return value as Record<string, unknown>;
}
