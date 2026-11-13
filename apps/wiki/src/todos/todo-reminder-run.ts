import type { NotifyTodoNoticeKind } from '@app/notify-contract';
import { isPageRef, type WikiTodoPageRef } from './page-ref';

export type RemindMode = 'midnight' | 'catch-up';

export type WikiRemindSlot = Exclude<NotifyTodoNoticeKind, 'todo.due'>;

export interface WikiRemindRow {
  id: string;
  bizCode: string;
  userId: string;
  title: string;
  content: string;
  status: string;
  startsAt: string | null;
  dueAt: Date | string | null;
  data: Record<string, unknown> | null;
}

export interface WikiRemindNotice {
  bizCode: string;
  userId: string;
  title: string;
  content: string;
  category: 'todo';
  source: 'wiki';
  data: Record<string, unknown>;
}

export interface WikiRemindDeps {
  list: (
    slot: WikiRemindSlot,
    mode: RemindMode,
    now: Date,
  ) => Promise<{ items: WikiRemindRow[]; today: string }>;
  claim: (
    slot: WikiRemindSlot,
    id: string,
    today: string,
    now: Date,
  ) => Promise<boolean>;
  release: (slot: WikiRemindSlot, id: string, today: string) => Promise<void>;
  send: (notice: WikiRemindNotice) => Promise<unknown>;
  warn: (message: string) => void;
}

const SLOTS: WikiRemindSlot[] = ['todo.started', 'todo.overdue', 'todo.progress'];

/**
 * wiki 催办编排：决定 slot 顺序与通知形态。
 * title/content 只放待办标题与页面等文件信息；自然语言由前端按 data.kind 本地化。
 */
export async function deliverWikiReminders(
  deps: WikiRemindDeps,
  now: Date,
  mode: RemindMode,
): Promise<number> {
  let sent = 0;
  for (const slot of SLOTS) {
    const { items, today } = await deps.list(slot, mode, now);
    for (const row of items) {
      if (await claimAndSend(deps, slot, row, today, now)) {
        sent += 1;
      }
    }
  }
  return sent;
}

async function claimAndSend(
  deps: WikiRemindDeps,
  slot: WikiRemindSlot,
  row: WikiRemindRow,
  today: string,
  now: Date,
): Promise<boolean> {
  const claimed = await deps.claim(slot, row.id, today, now);
  if (!claimed) {
    return false;
  }
  try {
    await deps.send(buildWikiRemindNotice(row, slot));
    return true;
  } catch (err) {
    await deps.release(slot, row.id, today);
    const message = err instanceof Error ? err.message : 'send failed';
    deps.warn(`待办 ${row.id} ${slot} 通知失败: ${message}`);
    return false;
  }
}

/** 中性载荷：kind + 页面/文件字段 + 原始标题；不拼中英文固定句 */
export function buildWikiRemindNotice(
  row: WikiRemindRow,
  kind: WikiRemindSlot,
): WikiRemindNotice {
  const data = row.data && typeof row.data === 'object' ? { ...row.data } : {};
  const page = pageRefOf(data);
  const pageId =
    typeof data.pageId === 'string'
      ? data.pageId
      : page?.id ?? '';
  const localItemId =
    typeof data.localItemId === 'string' ? data.localItemId : undefined;
  const title = (row.title.trim() || page?.title?.trim() || kind).slice(0, 120);
  const content = fileContent(row, page).slice(0, 4000) || title;
  return {
    bizCode: row.bizCode,
    userId: row.userId,
    title,
    content,
    category: 'todo',
    source: 'wiki',
    data: {
      ...data,
      kind,
      todoId: row.id,
      ...(pageId ? { pageId } : {}),
      ...(page ? { page } : {}),
      ...(localItemId ? { localItemId } : {}),
      ...(row.startsAt ? { startsAt: row.startsAt } : {}),
    },
  };
}

function pageRefOf(data: Record<string, unknown>): WikiTodoPageRef | null {
  return isPageRef(data.page) ? data.page : null;
}

/** 正文仅文件/页面相关信息，便于前端展示与跳转，不含固定自然语言 */
function fileContent(row: WikiRemindRow, page: WikiTodoPageRef | null): string {
  const parts: string[] = [];
  if (page?.title?.trim()) {
    parts.push(page.title.trim());
  }
  if (page?.slug?.trim()) {
    parts.push(page.slug.trim());
  }
  if (typeof row.data?.localItemId === 'string' && row.data.localItemId.trim()) {
    parts.push(row.data.localItemId.trim());
  }
  if (row.content?.trim() && row.content.trim() !== row.title.trim()) {
    parts.push(row.content.trim());
  }
  return parts.join('\n');
}
