/** 按字符粗切；中文约 400–800 字，重叠一小段保上下文 */
export function chunkText(
  text: string,
  opts?: { size?: number; overlap?: number },
): string[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').trim();
  if (!normalized) {
    return [];
  }
  const size = Math.max(80, opts?.size ?? 700);
  const overlap = Math.min(Math.floor(size / 2), Math.max(0, opts?.overlap ?? 80));
  if (normalized.length <= size) {
    return [normalized];
  }
  const chunks: string[] = [];
  let start = 0;
  while (start < normalized.length) {
    let end = Math.min(normalized.length, start + size);
    if (end < normalized.length) {
      const window = normalized.slice(start, end);
      const breakAt = Math.max(
        window.lastIndexOf('\n\n'),
        window.lastIndexOf('\n'),
        window.lastIndexOf('。'),
        window.lastIndexOf('；'),
        window.lastIndexOf('. '),
      );
      if (breakAt > size * 0.4) {
        end = start + breakAt + 1;
      }
    }
    const piece = normalized.slice(start, end).trim();
    if (piece) {
      chunks.push(piece);
    }
    if (end >= normalized.length) {
      break;
    }
    start = Math.max(0, end - overlap);
  }
  return chunks.slice(0, 80);
}
