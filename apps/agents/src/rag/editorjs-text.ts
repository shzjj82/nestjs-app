export type EditorJsBlock = {
  id?: string;
  type: string;
  data: Record<string, unknown>;
};

export type EditorJsDocument = {
  time?: number;
  version?: string;
  blocks?: EditorJsBlock[];
};

export type ExtractedAttachment = {
  name: string;
  url: string;
  ext: string;
};

const ATTACH_BLOCK_TYPES = new Set(['attaches', 'file', 'attachment']);

/** 从 EditorJS 抽出纯文本（去 HTML） */
export function editorJsToText(body: unknown, title = '', summary = ''): string {
  const parts: string[] = [];
  if (title.trim()) {
    parts.push(title.trim());
  }
  if (summary.trim()) {
    parts.push(summary.trim());
  }
  const doc = asEditorDoc(body);
  for (const block of doc.blocks ?? []) {
    const text = blockToText(block);
    if (text) {
      parts.push(text);
    }
  }
  return parts.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** 从 attaches / file / attachment 等 block 收集可解析附件 URL */
export function editorJsAttachments(body: unknown): ExtractedAttachment[] {
  const doc = asEditorDoc(body);
  const out: ExtractedAttachment[] = [];
  const seen = new Set<string>();
  for (const block of doc.blocks ?? []) {
    for (const item of attachmentFromBlock(block)) {
      const key = item.url;
      if (!key || seen.has(key)) {
        continue;
      }
      seen.add(key);
      out.push(item);
    }
  }
  return out;
}

/**
 * 收集附件的全部可匹配标识（url / fileId / 拼出的公开地址），
 * 用于文档更新时对比「被删掉的附件」并清理向量。
 */
export function editorJsAttachmentKeys(body: unknown): string[] {
  const doc = asEditorDoc(body);
  const keys = new Set<string>();
  for (const block of doc.blocks ?? []) {
    if (!ATTACH_BLOCK_TYPES.has(block.type)) {
      continue;
    }
    const data = block.data ?? {};
    const file = asRecord(data.file) ?? data;
    for (const raw of [file?.url, data.url, file?.fileId, data.fileId, file?.key, data.key]) {
      if (typeof raw !== 'string' || !raw.trim()) {
        continue;
      }
      const value = raw.trim();
      keys.add(value);
      const resolved = resolvePublicFileUrl(value);
      if (resolved) {
        keys.add(resolved);
      }
    }
  }
  return [...keys];
}

/** 附件块有名字但解析不出 URL（常见：source=local 仅 fileId UUID） */
export function editorJsUnresolvedAttachments(body: unknown): string[] {
  const doc = asEditorDoc(body);
  const names: string[] = [];
  for (const block of doc.blocks ?? []) {
    if (!ATTACH_BLOCK_TYPES.has(block.type)) {
      continue;
    }
    const data = block.data ?? {};
    const file = asRecord(data.file) ?? data;
    const url = resolveAttachmentUrl(data, file);
    if (url) {
      continue;
    }
    const name = String(
      data.title ?? data.name ?? file?.title ?? file?.name ?? file?.fileId ?? 'unknown',
    ).trim();
    if (name) {
      names.push(name);
    }
  }
  return names;
}

/**
 * url / OSS key → 可下载的公开地址。
 * fileId 为对象键（含 /）时可拼 OSS_PUBLIC_BASE；纯 UUID 无法解析则返回空。
 */
export function resolvePublicFileUrl(raw: string): string {
  const value = raw.trim();
  if (!value) {
    return '';
  }
  if (/^https?:\/\//i.test(value)) {
    return value;
  }
  // 纯 UUID / 无路径：前端 local 占位，本服务无法定位对象
  if (!value.includes('/')) {
    return '';
  }
  const key = value.replace(/^\/+/, '');
  const base = publicObjectBase();
  return base ? `${base}/${key}` : '';
}

function publicObjectBase(): string {
  const configured = (
    process.env.OSS_PUBLIC_BASE ||
    process.env.UPLOAD_PUBLIC_BASE ||
    ''
  )
    .trim()
    .replace(/\/+$/, '');
  if (configured) {
    return configured;
  }
  const bucket = (process.env.OSS_BUCKET || process.env.UPLOAD_BUCKET || '').trim();
  let region = (process.env.OSS_REGION || process.env.UPLOAD_REGION || '').trim();
  if (!bucket || !region) {
    return '';
  }
  if (!region.startsWith('oss-')) {
    region = `oss-${region}`;
  }
  return `https://${bucket}.${region}.aliyuncs.com`;
}

function asEditorDoc(body: unknown): EditorJsDocument {
  if (body && typeof body === 'object' && Array.isArray((body as EditorJsDocument).blocks)) {
    return body as EditorJsDocument;
  }
  return { blocks: [] };
}

function blockToText(block: EditorJsBlock): string {
  const data = block.data ?? {};
  switch (block.type) {
    case 'header':
    case 'paragraph':
    case 'quote':
      return stripHtml(String(data.text ?? ''));
    case 'list': {
      const items = Array.isArray(data.items) ? data.items : [];
      return items
        .map((item) => {
          if (typeof item === 'string') {
            return `- ${stripHtml(item)}`;
          }
          if (item && typeof item === 'object' && 'content' in item) {
            return `- ${stripHtml(String((item as { content?: unknown }).content ?? ''))}`;
          }
          return '';
        })
        .filter(Boolean)
        .join('\n');
    }
    case 'checklist': {
      const items = Array.isArray(data.items) ? data.items : [];
      return items
        .map((item) => {
          if (!item || typeof item !== 'object') {
            return '';
          }
          const rec = item as { text?: unknown; checked?: unknown };
          const mark = rec.checked ? '[x]' : '[ ]';
          return `${mark} ${stripHtml(String(rec.text ?? ''))}`;
        })
        .filter((line) => line.length > 4)
        .join('\n');
    }
    case 'code':
      return String(data.code ?? '').trim();
    case 'table': {
      const content = Array.isArray(data.content) ? data.content : [];
      return content
        .map((row) =>
          Array.isArray(row)
            ? row.map((cell) => stripHtml(String(cell ?? ''))).join(' | ')
            : '',
        )
        .filter(Boolean)
        .join('\n');
    }
    case 'attaches':
    case 'file':
    case 'attachment': {
      const file = asRecord(data.file) ?? data;
      const title = String(
        data.title ?? data.name ?? file?.title ?? file?.name ?? '附件',
      ).trim();
      const url = resolveAttachmentUrl(data, file);
      return url ? `【附件：${title}】 ${url}` : title ? `【附件：${title}】` : '';
    }
    case 'linkTool': {
      const meta = asRecord(data.meta);
      const title = String(meta?.title ?? data.link ?? '').trim();
      const desc = String(meta?.description ?? '').trim();
      const link = String(data.link ?? '').trim();
      return [title, desc, link].filter(Boolean).join('\n');
    }
    case 'image': {
      const file = asRecord(data.file);
      const caption = stripHtml(String(data.caption ?? ''));
      const url = String(file?.url ?? data.url ?? '').trim();
      return [caption, url ? `【图片】 ${url}` : ''].filter(Boolean).join('\n');
    }
    case 'pageLink': {
      const title = String(data.title ?? data.slug ?? '').trim();
      return title ? `【页面链接：${title}】` : '';
    }
    default: {
      if (typeof data.text === 'string') {
        return stripHtml(data.text);
      }
      return '';
    }
  }
}

function attachmentFromBlock(block: EditorJsBlock): ExtractedAttachment[] {
  if (!ATTACH_BLOCK_TYPES.has(block.type)) {
    return [];
  }
  const data = block.data ?? {};
  const file = asRecord(data.file) ?? data;
  const url = resolveAttachmentUrl(data, file);
  if (!url) {
    return [];
  }
  const name = String(
    data.title ?? data.name ?? file?.title ?? file?.name ?? fileNameFromUrl(url),
  ).trim();
  const ext = extFromName(name) || extFromName(url) || extFromMime(String(data.mime ?? file?.mime ?? ''));
  if (!['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt'].includes(ext)) {
    return [];
  }
  return [{ name: name || `file.${ext}`, url, ext }];
}

function resolveAttachmentUrl(
  data: Record<string, unknown>,
  file: Record<string, unknown> | null,
): string {
  const candidates = [
    file?.url,
    data.url,
    file?.fileId,
    data.fileId,
    file?.key,
    data.key,
  ];
  for (const raw of candidates) {
    if (typeof raw !== 'string' || !raw.trim()) {
      continue;
    }
    const resolved = resolvePublicFileUrl(raw);
    if (resolved) {
      return resolved;
    }
  }
  return '';
}

function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'text/plain': 'txt',
    'text/csv': 'csv',
  };
  return map[mime.trim().toLowerCase()] ?? '';
}

function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+\n/g, '\n')
    .trim();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function fileNameFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname;
    return decodeURIComponent(path.split('/').pop() ?? '');
  } catch {
    return url.split('/').pop() ?? '';
  }
}

function extFromName(name: string): string {
  const base = name.split('?')[0] ?? name;
  const i = base.lastIndexOf('.');
  return i >= 0 ? base.slice(i + 1).toLowerCase() : '';
}
