import type { NotifyTodoNoticeKind } from '@app/notify-contract';
import type { SendCommand } from '../common/input';
import { shanghaiDate, shanghaiDayOf, shanghaiStart } from './shanghai-day';

export type RemindMode = 'midnight' | 'catch-up';

interface WikiTodoRow {
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

interface LegacyDueRow {
  id: string;
  bizCode: string;
  userId: string;
  title: string;
  content: string;
  data?: Record<string, unknown> | null;
}

export interface DueTodoDeps {
  query: (sql: string, params: unknown[]) => Promise<unknown>;
  send: (command: SendCommand) => Promise<unknown>;
  warn: (message: string) => void;
}

/** wiki 三则通知 + 非 wiki 旧到期提醒 */
export async function deliverDueTodos(
  deps: DueTodoDeps,
  now: Date,
  mode: RemindMode,
): Promise<number> {
  const today = shanghaiDate(now);
  let sent = 0;
  sent += await deliverWikiStarted(deps, today, now, mode);
  sent += await deliverWikiOverdue(deps, today, now, mode);
  sent += await deliverWikiProgress(deps, today, now, mode);
  sent += await deliverLegacyDueTodos(deps, today, now, mode);
  return sent;
}

async function deliverWikiStarted(
  deps: DueTodoDeps,
  today: string,
  now: Date,
  mode: RemindMode,
): Promise<number> {
  const rows = asWikiRows(
    await deps.query(wikiStartedSql(mode), wikiDayParams(today, now, mode)),
  );
  let sent = 0;
  for (const row of rows) {
    if (await sendStarted(deps, row, now)) {
      sent += 1;
    }
  }
  return sent;
}

async function deliverWikiProgress(
  deps: DueTodoDeps,
  today: string,
  now: Date,
  mode: RemindMode,
): Promise<number> {
  const rows = asWikiRows(
    await deps.query(wikiProgressSql(mode), wikiDayParams(today, now, mode)),
  );
  let sent = 0;
  for (const row of rows) {
    if (
      await claimAndSend(deps, {
        row,
        today,
        kind: 'todo.progress',
        title: `请更新完成进度：${row.title}`.slice(0, 120),
        content: `请更新「${row.title}」的完成进度。${row.content}`.slice(0, 4000),
        claimSql: `
          UPDATE nt_todos
          SET last_progress_notice_on = $1::date
          WHERE id = $2
            AND status = 'in_progress'
            AND (last_progress_notice_on IS NULL OR last_progress_notice_on <> $1::date)
          RETURNING id`,
        releaseSql: `
          UPDATE nt_todos
          SET last_progress_notice_on = NULL
          WHERE id = $1 AND last_progress_notice_on = $2::date`,
      })
    ) {
      sent += 1;
    }
  }
  return sent;
}

async function deliverWikiOverdue(
  deps: DueTodoDeps,
  today: string,
  now: Date,
  mode: RemindMode,
): Promise<number> {
  const rows = asWikiRows(
    await deps.query(wikiOverdueSql(mode), wikiDayParams(today, now, mode)),
  );
  let sent = 0;
  for (const row of rows) {
    if (
      await claimAndSend(deps, {
        row,
        today,
        kind: 'todo.overdue',
        title: `催办：${row.title}`.slice(0, 120),
        content: `催办：未在预计结束日完成 — ${row.title}。${row.content}`.slice(0, 4000),
        claimSql: `
          UPDATE nt_todos
          SET last_overdue_notice_on = $1::date
          WHERE id = $2
            AND status IN ('pending', 'in_progress', 'open')
            AND (last_overdue_notice_on IS NULL OR last_overdue_notice_on <> $1::date)
          RETURNING id`,
        releaseSql: `
          UPDATE nt_todos
          SET last_overdue_notice_on = NULL
          WHERE id = $1 AND last_overdue_notice_on = $2::date`,
      })
    ) {
      sent += 1;
    }
  }
  return sent;
}

async function deliverLegacyDueTodos(
  deps: DueTodoDeps,
  today: string,
  now: Date,
  mode: RemindMode,
): Promise<number> {
  const rows = asLegacyRows(
    await deps.query(legacyDueSql(mode), wikiDayParams(today, now, mode)),
  );
  let sent = 0;
  for (const row of rows) {
    if (await sendLegacyDue(deps, row, today)) {
      sent += 1;
    }
  }
  return sent;
}

async function sendStarted(
  deps: DueTodoDeps,
  row: WikiTodoRow,
  now: Date,
): Promise<boolean> {
  // 只记「开始日通知已发」，不改 status（pending → in_progress 由用户手动开始）
  const claimed = await deps.query(
    `
      UPDATE nt_todos
      SET started_notice_at = $1::timestamptz
      WHERE id = $2
        AND status IN ('pending', 'open')
        AND started_notice_at IS NULL
      RETURNING id
    `,
    [now.toISOString(), row.id],
  );
  if (!Array.isArray(claimed) || claimed.length === 0) {
    return false;
  }
  try {
    await deps.send(
      noticeOf(row, 'todo.started', '待办已开始', `待办已开始：${row.title}。${row.content}`),
    );
    return true;
  } catch (err) {
    await deps.query(
      `
        UPDATE nt_todos
        SET started_notice_at = NULL
        WHERE id = $1 AND started_notice_at IS NOT NULL
      `,
      [row.id],
    );
    const message = err instanceof Error ? err.message : 'send failed';
    deps.warn(`待办 ${row.id} 开始通知失败: ${message}`);
    return false;
  }
}

async function claimAndSend(
  deps: DueTodoDeps,
  input: {
    row: WikiTodoRow;
    today: string;
    kind: NotifyTodoNoticeKind;
    title: string;
    content: string;
    claimSql: string;
    releaseSql: string;
  },
): Promise<boolean> {
  const claimed = await deps.query(input.claimSql, [input.today, input.row.id]);
  if (!Array.isArray(claimed) || claimed.length === 0) {
    return false;
  }
  try {
    await deps.send(noticeOf(input.row, input.kind, input.title, input.content));
    return true;
  } catch (err) {
    await deps.query(input.releaseSql, [input.row.id, input.today]);
    const message = err instanceof Error ? err.message : 'send failed';
    deps.warn(`待办 ${input.row.id} ${input.kind} 通知失败: ${message}`);
    return false;
  }
}

async function sendLegacyDue(
  deps: DueTodoDeps,
  row: LegacyDueRow,
  today: string,
): Promise<boolean> {
  const claimed = await deps.query(
    `UPDATE nt_todos
     SET reminded_on = $1::date
     WHERE id = $2
       AND status IN ('pending', 'in_progress', 'open')
       AND (reminded_on IS NULL OR reminded_on <> $1::date)
     RETURNING id`,
    [today, row.id],
  );
  if (!Array.isArray(claimed) || claimed.length === 0) {
    return false;
  }
  try {
    const content = `今天是截止日。${row.content}`.slice(0, 4000);
    const linked =
      row.data && typeof row.data === 'object' && !Array.isArray(row.data)
        ? row.data
        : {};
    await deps.send({
      bizCode: row.bizCode,
      userId: row.userId,
      title: (`待办到期：${row.title}`).slice(0, 120),
      content: content || '今天是截止日。',
      category: 'todo',
      source: 'system',
      status: 'pending',
      data: { ...linked, todoId: row.id },
      dueAt: null,
      startsAt: null,
    });
    return true;
  } catch (err) {
    await deps.query(
      `UPDATE nt_todos
       SET reminded_on = NULL
       WHERE id = $1 AND reminded_on = $2::date`,
      [row.id, today],
    );
    const message = err instanceof Error ? err.message : 'send failed';
    deps.warn(`待办 ${row.id} 到期通知失败: ${message}`);
    return false;
  }
}

function noticeOf(
  row: WikiTodoRow,
  kind: NotifyTodoNoticeKind,
  title: string,
  content: string,
): SendCommand {
  const data = row.data && typeof row.data === 'object' ? row.data : {};
  const pageId =
    typeof data.pageId === 'string'
      ? data.pageId
      : data.page && typeof data.page === 'object' && !Array.isArray(data.page)
        ? String((data.page as Record<string, unknown>).id ?? '')
        : '';
  const localItemId =
    typeof data.localItemId === 'string' ? data.localItemId : undefined;
  return {
    bizCode: row.bizCode,
    userId: row.userId,
    title: title.slice(0, 120),
    content: (content || title).slice(0, 4000),
    category: 'todo',
    source: 'system',
    status: 'pending',
    data: {
      ...data,
      kind,
      todoId: row.id,
      ...(pageId ? { pageId } : {}),
      ...(localItemId ? { localItemId } : {}),
    },
    dueAt: null,
    startsAt: null,
  };
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

function wikiStartedSql(mode: RemindMode): string {
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
    WHERE ${wikiScope(mode)}
      AND status IN ('pending', 'in_progress', 'open')
      AND ${endDateExpr()} IS NOT NULL
      AND ${endDateExpr()} < $1::text
      AND (last_overdue_notice_on IS NULL OR last_overdue_notice_on <> $1::date)
    ORDER BY created_at ASC
  `;
}

function legacyDueSql(mode: RemindMode): string {
  const createdBeforeMidnight = mode === 'catch-up' ? 'AND created_at < $2::timestamptz' : '';
  return `
    SELECT id,
           biz_code AS "bizCode",
           user_id AS "userId",
           title,
           content,
           data
    FROM nt_todos
    WHERE source <> 'wiki'
      AND status IN ('pending', 'in_progress', 'open')
      AND due_at IS NOT NULL
      AND (due_at AT TIME ZONE 'Asia/Shanghai')::date = $1::date
      AND (reminded_on IS NULL OR reminded_on <> $1::date)
      ${createdBeforeMidnight}
    ORDER BY created_at ASC
  `;
}

function wikiDayParams(today: string, now: Date, mode: RemindMode): unknown[] {
  if (mode === 'catch-up') {
    return [today, shanghaiStart(now).toISOString()];
  }
  return [today];
}

function asWikiRows(value: unknown): WikiTodoRow[] {
  return Array.isArray(value) ? (value as WikiTodoRow[]) : [];
}

function asLegacyRows(value: unknown): LegacyDueRow[] {
  return Array.isArray(value) ? (value as LegacyDueRow[]) : [];
}

/** 供测试：结束日解析 */
export function endDateOf(row: {
  dueAt?: Date | string | null;
  data?: Record<string, unknown> | null;
}): string | null {
  const end = row.data && typeof row.data.end === 'string' ? row.data.end.trim() : '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    return end;
  }
  if (row.dueAt instanceof Date) {
    return shanghaiDayOf(row.dueAt);
  }
  if (typeof row.dueAt === 'string' && row.dueAt) {
    const parsed = new Date(row.dueAt);
    return Number.isNaN(parsed.getTime()) ? null : shanghaiDayOf(parsed);
  }
  return null;
}
