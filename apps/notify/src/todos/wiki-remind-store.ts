import { shanghaiStart } from '@app/common';
import type { NotifyTodoNoticeKind } from '@app/notify-contract';

/** wiki 催办槽位：与通知 data.kind 对齐；查询/占坑只做存储，语义由 wiki 决定 */
export type WikiRemindSlot = NotifyTodoNoticeKind;

export type RemindMode = 'midnight' | 'catch-up';

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

export function isWikiRemindSlot(value: unknown): value is WikiRemindSlot {
  return value === 'todo.started' || value === 'todo.progress' || value === 'todo.overdue';
}

export function wikiRemindListSql(slot: WikiRemindSlot, mode: RemindMode): string {
  if (slot === 'todo.started') {
    return wikiStartedSql(mode);
  }
  if (slot === 'todo.progress') {
    return wikiProgressSql(mode);
  }
  return wikiOverdueSql(mode);
}

export function wikiRemindListParams(
  today: string,
  now: Date,
  mode: RemindMode,
): unknown[] {
  if (mode === 'catch-up') {
    return [today, shanghaiStart(now).toISOString()];
  }
  return [today];
}

export function wikiRemindClaimSql(slot: WikiRemindSlot): string {
  if (slot === 'todo.started') {
    return `
      UPDATE nt_todos
      SET started_notice_at = $1::timestamptz
      WHERE id = $2
        AND status IN ('pending', 'open')
        AND started_notice_at IS NULL
      RETURNING id`;
  }
  if (slot === 'todo.progress') {
    return `
      UPDATE nt_todos
      SET last_progress_notice_on = $1::date
      WHERE id = $2
        AND status = 'in_progress'
        AND (last_progress_notice_on IS NULL OR last_progress_notice_on <> $1::date)
      RETURNING id`;
  }
  return `
    UPDATE nt_todos
    SET last_overdue_notice_on = $1::date
    WHERE id = $2
      AND status IN ('pending', 'in_progress', 'open')
      AND (last_overdue_notice_on IS NULL OR last_overdue_notice_on <> $1::date)
    RETURNING id`;
}

export function wikiRemindReleaseSql(slot: WikiRemindSlot): string {
  if (slot === 'todo.started') {
    return `
      UPDATE nt_todos
      SET started_notice_at = NULL
      WHERE id = $1 AND started_notice_at IS NOT NULL`;
  }
  if (slot === 'todo.progress') {
    return `
      UPDATE nt_todos
      SET last_progress_notice_on = NULL
      WHERE id = $1 AND last_progress_notice_on = $2::date`;
  }
  return `
    UPDATE nt_todos
    SET last_overdue_notice_on = NULL
    WHERE id = $1 AND last_overdue_notice_on = $2::date`;
}

/** started 用 timestamptz；progress/overdue 用上海日 */
export function wikiRemindClaimParams(
  slot: WikiRemindSlot,
  id: string,
  today: string,
  now: Date,
): unknown[] {
  if (slot === 'todo.started') {
    return [now.toISOString(), id];
  }
  return [today, id];
}

export function wikiRemindReleaseParams(
  slot: WikiRemindSlot,
  id: string,
  today: string,
): unknown[] {
  if (slot === 'todo.started') {
    return [id];
  }
  return [id, today];
}

function wikiScope(mode: RemindMode): string {
  const createdBeforeMidnight = mode === 'catch-up' ? 'AND created_at < $2::timestamptz' : '';
  return `
    source = 'wiki'
    AND COALESCE((data->>'notify')::boolean, false) = true
    ${createdBeforeMidnight}
  `;
}

function endDateExpr(): string {
  return `
    COALESCE(
      NULLIF(TRIM(data->>'end'), ''),
      (due_at AT TIME ZONE 'Asia/Shanghai')::date::text
    )
  `;
}

function selectCols(): string {
  return `
    SELECT id,
           biz_code AS "bizCode",
           user_id AS "userId",
           title,
           content,
           status,
           starts_at::text AS "startsAt",
           due_at AS "dueAt",
           data
    FROM nt_todos
  `;
}

function wikiStartedSql(mode: RemindMode): string {
  return `
    ${selectCols()}
    WHERE ${wikiScope(mode)}
      AND status IN ('pending', 'open')
      AND starts_at IS NOT NULL
      AND starts_at <= $1::date
      AND started_notice_at IS NULL
    ORDER BY created_at ASC
  `;
}

function wikiProgressSql(mode: RemindMode): string {
  return `
    ${selectCols()}
    WHERE ${wikiScope(mode)}
      AND status = 'in_progress'
      AND starts_at IS NOT NULL
      AND starts_at <= $1::date
      AND (
        ${endDateExpr()} IS NULL
        OR ${endDateExpr()} >= $1::text
      )
      AND (last_progress_notice_on IS NULL OR last_progress_notice_on <> $1::date)
    ORDER BY created_at ASC
  `;
}

function wikiOverdueSql(mode: RemindMode): string {
  return `
    ${selectCols()}
    WHERE ${wikiScope(mode)}
      AND status IN ('pending', 'in_progress', 'open')
      AND ${endDateExpr()} IS NOT NULL
      AND ${endDateExpr()} < $1::text
      AND (last_overdue_notice_on IS NULL OR last_overdue_notice_on <> $1::date)
    ORDER BY created_at ASC
  `;
}
