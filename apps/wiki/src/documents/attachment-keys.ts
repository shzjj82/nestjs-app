import type { EditorJsDocument } from '../common/shared';
import { isEditorJsDocument } from '../common/shared';

const ATTACH_BLOCK_TYPES = new Set(['attachment', 'attaches', 'file']);

/** 收集 EditorJS 附件块里的 url / fileId / key，用于对比被删附件 */
export function editorJsAttachmentKeys(body: unknown): string[] {
  if (!isEditorJsDocument(body)) {
    return [];
  }
  const keys = new Set<string>();
  for (const block of (body as EditorJsDocument).blocks ?? []) {
    if (!ATTACH_BLOCK_TYPES.has(block.type)) {
      continue;
    }
    const data = block.data ?? {};
    const file =
      data.file && typeof data.file === 'object'
        ? (data.file as Record<string, unknown>)
        : data;
    for (const raw of [file.url, data.url, file.fileId, data.fileId, file.key, data.key]) {
      if (typeof raw !== 'string' || !raw.trim()) {
        continue;
      }
      keys.add(raw.trim());
    }
  }
  return [...keys];
}

/** 更新前后对比：返回旧文有、新文没有的附件标识 */
export function removedAttachmentKeys(before: unknown, after: unknown): string[] {
  const keep = new Set(editorJsAttachmentKeys(after));
  return editorJsAttachmentKeys(before).filter((key) => !keep.has(key));
}
