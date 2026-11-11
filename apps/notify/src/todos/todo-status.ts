import type { NotifyTodoStatus } from '@app/notify-contract';
import { rpcFail } from '@app/common';
import { shanghaiDate } from './shanghai-day';

export type CanonicalTodoStatus = 'pending' | 'in_progress' | 'done' | 'cancelled';

const ACTIVE: CanonicalTodoStatus[] = ['pending', 'in_progress'];

/** 读出归一：旧 open → pending */
export function normalizeTodoStatus(raw: string | null | undefined): CanonicalTodoStatus {
  if (raw === 'open' || raw === 'pending') {
    return 'pending';
  }
  if (raw === 'in_progress' || raw === 'done' || raw === 'cancelled') {
    return raw;
  }
  rpcFail(400, 'status 只能是 pending、in_progress、done 或 cancelled');
}

export function isActiveStatus(status: string): boolean {
  const normalized = status === 'open' ? 'pending' : status;
  return ACTIVE.includes(normalized as CanonicalTodoStatus);
}

/**
 * 列表过滤。旧客户端 `status=open` 表示「未结束」= pending + in_progress
 * （不是仅 pending）；done / cancelled 才被排除。
 */
export function parseStatusFilter(raw: unknown): CanonicalTodoStatus[] | undefined {
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }
  const text = String(raw)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (!text.length) {
    return undefined;
  }
  const out = new Set<CanonicalTodoStatus>();
  for (const part of text) {
    if (part === 'open') {
      out.add('pending');
      out.add('in_progress');
      continue;
    }
    out.add(normalizeTodoStatus(part));
  }
  return [...out];
}

export function applyStatusTransition(input: {
  current: string;
  next: CanonicalTodoStatus;
  startsAt: string | null;
  now?: Date;
}): {
  status: CanonicalTodoStatus;
  startedAt?: Date | null;
  finishedAt?: Date | null;
  cancelledAt?: Date | null;
  clearFinished?: boolean;
  clearCancelled?: boolean;
} {
  const current = normalizeTodoStatus(input.current);
  const next = input.next;
  const now = input.now ?? new Date();

  if (current === next) {
    return { status: next };
  }

  if (next === 'in_progress') {
    if (current === 'pending' || current === 'in_progress') {
      return { status: 'in_progress', startedAt: now };
    }
    if (current === 'done' || current === 'cancelled') {
      return {
        status: 'in_progress',
        startedAt: now,
        clearFinished: true,
        clearCancelled: true,
      };
    }
    rpcFail(400, '非法状态跳转');
  }

  if (next === 'done') {
    if (!isActiveStatus(current)) {
      rpcFail(400, '仅活跃待办可完成');
    }
    return {
      status: 'done',
      finishedAt: now,
      clearCancelled: true,
    };
  }

  if (next === 'cancelled') {
    if (!isActiveStatus(current)) {
      rpcFail(400, '仅活跃待办可终止');
    }
    return {
      status: 'cancelled',
      cancelledAt: now,
      clearFinished: true,
    };
  }

  // next === pending：活跃态可回退；结束态则 reopen
  if (current === 'pending' || current === 'in_progress') {
    return { status: 'pending' };
  }
  if (current !== 'done' && current !== 'cancelled') {
    rpcFail(400, '仅已完成或已终止的待办可重新打开');
  }
  return {
    status: 'pending',
    clearFinished: true,
    clearCancelled: true,
  };
}

/**
 * 编辑器兼容：顶层 status=open 只表示「未结束」，细态在 data.localStatus。
 * - open + localStatus → 用 localStatus
 * - 仅 open → 不改状态（undefined）
 */
export function resolvePatchStatus(
  rawStatus: unknown,
  data: Record<string, unknown> | null | undefined,
): CanonicalTodoStatus | undefined {
  if (rawStatus === undefined || rawStatus === null || rawStatus === '') {
    return undefined;
  }
  const raw = String(rawStatus).trim();
  if (raw === 'open') {
    const local =
      data && typeof data.localStatus === 'string' ? data.localStatus.trim() : '';
    if (
      local === 'pending' ||
      local === 'in_progress' ||
      local === 'done' ||
      local === 'cancelled' ||
      local === 'open'
    ) {
      return normalizeTodoStatus(local === 'open' ? 'pending' : local);
    }
    return undefined;
  }
  return normalizeTodoStatus(raw);
}

/** reopen：按 startsAt 与今天决定 pending / in_progress */
export function reopenTargetStatus(
  startsAt: string | null,
  now: Date = new Date(),
): CanonicalTodoStatus {
  if (!startsAt) {
    return 'pending';
  }
  const today = shanghaiDate(now);
  return today >= startsAt ? 'in_progress' : 'pending';
}

export function asStoredStatus(status: CanonicalTodoStatus): NotifyTodoStatus {
  return status;
}
