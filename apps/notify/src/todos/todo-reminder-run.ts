import { shanghaiDate, shanghaiStart } from '@app/common';
import type { SendCommand } from '../common/input';

export type RemindMode = 'midnight' | 'catch-up';

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

/**
 * 非 wiki 待办的截止日提醒（notify 自有存储职责）。
 * wiki 催办由 wiki 服务定时触发，不经过此处。
 * 文案只带待办标题/正文与 data.kind，由客户端按语言渲染。
 */
export async function deliverDueTodos(
  deps: DueTodoDeps,
  now: Date,
  mode: RemindMode,
): Promise<number> {
  const today = shanghaiDate(now);
  return deliverLegacyDueTodos(deps, today, now, mode);
}

async function deliverLegacyDueTodos(
  deps: DueTodoDeps,
  today: string,
  now: Date,
  mode: RemindMode,
): Promise<number> {
  const rows = asLegacyRows(
    await deps.query(legacyDueSql(mode), listParams(today, now, mode)),
  );
  let sent = 0;
  for (const row of rows) {
    if (await sendLegacyDue(deps, row, today)) {
      sent += 1;
    }
  }
  return sent;
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
    const linked =
      row.data && typeof row.data === 'object' && !Array.isArray(row.data)
        ? row.data
        : {};
    const title = (row.title || row.id).slice(0, 120);
    const content = (row.content || row.title || row.id).slice(0, 4000);
    await deps.send({
      bizCode: row.bizCode,
      userId: row.userId,
      title,
      content,
      category: 'todo',
      source: 'system',
      status: 'pending',
      data: { ...linked, kind: 'todo.due', todoId: row.id },
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

function listParams(today: string, now: Date, mode: RemindMode): unknown[] {
  if (mode === 'catch-up') {
    return [today, shanghaiStart(now).toISOString()];
  }
  return [today];
}

function asLegacyRows(value: unknown): LegacyDueRow[] {
  return Array.isArray(value) ? (value as LegacyDueRow[]) : [];
}
