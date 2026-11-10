import type { SendCommand } from '../common/input';
import { shanghaiDate, shanghaiStart } from './shanghai-day';

export type RemindMode = 'midnight' | 'catch-up';

interface DueTodoRow {
  id: string;
  bizCode: string;
  userId: string;
  title: string;
  content: string;
}

export interface DueTodoDeps {
  query: (sql: string, params: string[]) => Promise<unknown>;
  send: (command: SendCommand) => Promise<unknown>;
  warn: (message: string) => void;
}

/** 找出当天到期的未完成待办，占住提醒日后再发通知。发送失败会放开占位，下次还能补发。 */
export async function deliverDueTodos(
  deps: DueTodoDeps,
  now: Date,
  mode: RemindMode,
): Promise<number> {
  const today = shanghaiDate(now);
  const rows = await deps.query(dueSql(mode), dueParams(today, now, mode));
  let sent = 0;
  for (const row of asRows(rows)) {
    if (await sendOne(deps, row, today)) {
      sent += 1;
    }
  }
  return sent;
}

async function sendOne(deps: DueTodoDeps, row: DueTodoRow, today: string): Promise<boolean> {
  const claimed = await deps.query(
    `UPDATE nt_todos
     SET reminded_on = $1::date
     WHERE id = $2
       AND status = 'open'
       AND (reminded_on IS NULL OR reminded_on <> $1::date)
     RETURNING id`,
    [today, row.id],
  );
  if (!Array.isArray(claimed) || claimed.length === 0) {
    return false;
  }
  try {
    await deps.send(noticeOf(row));
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

function dueSql(mode: RemindMode): string {
  const createdBeforeMidnight = mode === 'catch-up' ? 'AND created_at < $2::timestamptz' : '';
  return `
    SELECT id,
           biz_code AS "bizCode",
           user_id AS "userId",
           title,
           content
    FROM nt_todos
    WHERE status = 'open'
      AND due_at IS NOT NULL
      AND (due_at AT TIME ZONE 'Asia/Shanghai')::date = $1::date
      AND (reminded_on IS NULL OR reminded_on <> $1::date)
      ${createdBeforeMidnight}
    ORDER BY created_at ASC
  `;
}

function dueParams(today: string, now: Date, mode: RemindMode): string[] {
  if (mode === 'catch-up') {
    return [today, shanghaiStart(now).toISOString()];
  }
  return [today];
}

function noticeOf(row: DueTodoRow): SendCommand {
  const content = `今天是截止日。${row.content}`.slice(0, 4000);
  return {
    bizCode: row.bizCode,
    userId: row.userId,
    title: noticeTitle(row.title),
    content: content || '今天是截止日。',
    category: 'todo',
    source: 'system',
    data: { todoId: row.id },
    dueAt: null,
  };
}

function noticeTitle(title: string): string {
  const text = `待办到期：${title}`;
  return text.length <= 120 ? text : text.slice(0, 120);
}

function asRows(value: unknown): DueTodoRow[] {
  return Array.isArray(value) ? (value as DueTodoRow[]) : [];
}
