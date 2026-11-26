const TODO_ASK = /待办|未完成|未开始|进行中|已完成|已终止|todo/i;

/** 提问在问待办时，由 wiki 附上本人待办，不再让编辑器把每页正文拉下来。 */
export function asksAboutTodos(text: string): boolean {
  return TODO_ASK.test(text);
}

/** 只问一种状态时收窄列表。几种状态混在一起就全部给出。 */
export function todoStatusQuery(text: string): string | undefined {
  const wantDone = /已完成/.test(text);
  const wantCancel = /已终止|取消|终止/.test(text);
  const wantActive = /未完成|未开始|进行中|待办|todo/i.test(text);
  if (wantDone && !wantActive && !wantCancel) {
    return 'done';
  }
  if (wantCancel && !wantActive && !wantDone) {
    return 'cancelled';
  }
  if (wantActive && !wantDone && !wantCancel) {
    return 'pending,in_progress';
  }
  return undefined;
}

export function formatTodoContext(items: unknown[]): string {
  const lines = ['只能根据下面的待办回答。没有列出的任务就说没有。不要编造，也不要说用户上传了文件。'];
  const grouped = new Map<string, string[]>();
  for (const item of items) {
    const row = asRow(item);
    if (!row) {
      continue;
    }
    const title = row.pageTitle || '未关联页面';
    const bucket = grouped.get(title) ?? [];
    bucket.push(`- ${statusLabel(row.status)}：${row.title}${rangeOf(row)}`);
    grouped.set(title, bucket);
  }
  if (!grouped.size) {
    return '只能根据下面的待办回答。当前没有符合条件的待办。不要编造。';
  }
  for (const [title, rows] of grouped) {
    lines.push(`《${title}》`, ...rows);
  }
  return lines.join('\n');
}

export function lastUserText(payload: Record<string, unknown>): string {
  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const item = messages[index];
    if (!item || typeof item !== 'object') {
      continue;
    }
    const row = item as Record<string, unknown>;
    if (row.role === 'user' && typeof row.content === 'string') {
      return row.content;
    }
  }
  return '';
}

export function withTodoContext(payload: Record<string, unknown>, context: string): Record<string, unknown> {
  const messages = Array.isArray(payload.messages) ? [...payload.messages] : [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const item = messages[index];
    if (!item || typeof item !== 'object') {
      continue;
    }
    const row = item as Record<string, unknown>;
    if (row.role !== 'user' || typeof row.content !== 'string') {
      continue;
    }
    const block = `${context}\n\n${row.content}`;
    messages[index] = { ...row, content: block.slice(0, 8000) };
    return { ...payload, messages, rag: false };
  }
  return payload;
}

function asRow(item: unknown): { title: string; status: string; pageTitle: string; startsAt: string; dueAt: string } | null {
  if (!item || typeof item !== 'object') {
    return null;
  }
  const row = item as Record<string, unknown>;
  const title = text(row.title);
  if (!title) {
    return null;
  }
  const page = row.page && typeof row.page === 'object' ? (row.page as Record<string, unknown>) : null;
  return {
    title,
    status: text(row.status),
    pageTitle: text(page?.title),
    startsAt: text(row.startsAt).slice(0, 10),
    dueAt: text(row.dueAt).slice(0, 10),
  };
}

function rangeOf(row: { startsAt: string; dueAt: string }): string {
  if (!row.startsAt && !row.dueAt) {
    return '';
  }
  return `（${row.startsAt || '?'}至${row.dueAt || '?'}）`;
}

function statusLabel(status: string): string {
  switch (status) {
    case 'in_progress':
      return '进行中';
    case 'done':
      return '已完成';
    case 'cancelled':
      return '已终止';
    default:
      return '未开始';
  }
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
