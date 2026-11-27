import { editorJsToText } from './editorjs-text';

export type RagTodo = {
  title: string;
  status: string;
  startsAt: string;
  dueAt: string;
  content: string;
};

/** 正文里尚未同步的待办。已同步的任务只留 id，正文在待办服务里。 */
export function todosFromEditorJs(body: unknown): RagTodo[] {
  const blocks = editorBlocks(body);
  const out: RagTodo[] = [];
  for (const block of blocks) {
    if (block.type !== 'todo') {
      continue;
    }
    const items = Array.isArray(block.data?.items) ? block.data.items : [];
    for (const item of items) {
      const row = asTodo(item);
      if (row) {
        out.push(row);
      }
    }
  }
  return out;
}

/** 待办服务里的任务优先。正文里同名的未同步条目不再重复写入。 */
export function mergeRagTodos(remote: RagTodo[], local: RagTodo[]): RagTodo[] {
  const titles = new Set(remote.map((item) => item.title));
  return [...remote, ...local.filter((item) => !titles.has(item.title))];
}

export function formatTodoIndexText(items: RagTodo[]): string {
  const lines = ['【待办】'];
  for (const item of items) {
    const title = item.title.trim();
    if (!title) {
      continue;
    }
    const range = rangeOf(item.startsAt, item.dueAt);
    lines.push(`- ${statusLabel(item.status)}：${title}${range}`);
    const detail = item.content.trim();
    if (detail) {
      lines.push(detail);
    }
  }
  return lines.length > 1 ? lines.join('\n') : '';
}

export function ragTodoFromRecord(raw: unknown): RagTodo | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const row = raw as Record<string, unknown>;
  const data = row.data && typeof row.data === 'object' ? (row.data as Record<string, unknown>) : null;
  if (data?.kind === 'list') {
    return null;
  }
  const title = text(row.title);
  if (!title) {
    return null;
  }
  const start = text(row.startsAt).slice(0, 10) || text(data?.start).slice(0, 10);
  const due = text(row.dueAt).slice(0, 10) || text(data?.end).slice(0, 10);
  return {
    title,
    status: text(row.status),
    startsAt: /^\d{4}-\d{2}-\d{2}$/.test(start) ? start : '',
    dueAt: /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : '',
    content: plainContent(row.content),
  };
}

function asTodo(item: unknown): RagTodo | null {
  if (!item || typeof item !== 'object') {
    return null;
  }
  const row = item as Record<string, unknown>;
  const title = text(row.text ?? row.title);
  if (!title) {
    return null;
  }
  const start = text(row.start ?? row.startsAt).slice(0, 10);
  const end = text(row.end ?? row.dueAt).slice(0, 10);
  return {
    title,
    status: text(row.status),
    startsAt: /^\d{4}-\d{2}-\d{2}$/.test(start) ? start : '',
    dueAt: /^\d{4}-\d{2}-\d{2}$/.test(end) ? end : '',
    content: plainContent(row.content),
  };
}

function plainContent(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return editorJsToText(JSON.parse(trimmed)).slice(0, 400);
    } catch {
      return '';
    }
  }
  return trimmed.replace(/\s+/g, ' ').slice(0, 400);
}

function rangeOf(startsAt: string, dueAt: string): string {
  if (!startsAt && !dueAt) {
    return '';
  }
  return `（${startsAt || '?'}至${dueAt || '?'}）`;
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

function editorBlocks(body: unknown): Array<{ type?: string; data?: Record<string, unknown> }> {
  if (!body || typeof body !== 'object' || !Array.isArray((body as { blocks?: unknown }).blocks)) {
    return [];
  }
  return (body as { blocks: Array<{ type?: string; data?: Record<string, unknown> }> }).blocks;
}
