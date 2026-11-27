/** 按行切开。表格记录不从分号中间断开，续块仍带表名。 */
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
  let bucket: string[] = [];
  let length = 0;
  let banner = '';

  const pushBucket = () => {
    const piece = bucket.join('\n').trim();
    if (piece) {
      chunks.push(piece);
    }
    bucket = [];
    length = 0;
  };

  const addLine = (line: string) => {
    const nextLength = bucket.length === 0 ? line.length : length + 1 + line.length;
    if (bucket.length > 0 && nextLength > size) {
      pushBucket();
      if (banner && isLabeledRow(line)) {
        bucket.push(banner);
        length = banner.length;
      }
    }
    length += bucket.length === 0 ? line.length : line.length + 1;
    bucket.push(line);
  };

  for (const line of normalized.split('\n')) {
    if (isTableBanner(line)) {
      if (bucket.length > 0) {
        pushBucket();
      }
      banner = line;
    } else if (line.trim() && !isLabeledRow(line)) {
      if (banner && bucket.length > 0) {
        pushBucket();
      }
      banner = '';
    }
    if (line.length > size && isLabeledRow(line)) {
      if (!(bucket.length === 1 && bucket[0] === banner)) {
        pushBucket();
      } else {
        bucket = [];
        length = 0;
      }
      for (const part of splitLabeledRow(line, size)) {
        chunks.push(banner ? `${banner}\n${part}` : part);
      }
      continue;
    }
    if (line.length > size) {
      pushBucket();
      chunks.push(...splitPlain(line, size, overlap));
      continue;
    }
    addLine(line);
  }
  pushBucket();
  return chunks.slice(0, 80);
}

function isTableBanner(line: string): boolean {
  return line.startsWith('【表：') || line.startsWith('【表格】');
}

function isLabeledRow(line: string): boolean {
  return line.includes('：') && line.includes('；');
}

function splitLabeledRow(line: string, size: number): string[] {
  const fields = line.split('；');
  if (fields.length < 2) {
    return [line];
  }
  const identity = fields[0];
  const parts: string[] = [];
  let group = [identity];
  let length = identity.length;
  for (const field of fields.slice(1)) {
    const extra = 1 + field.length;
    if (group.length > 1 && length + extra > size) {
      parts.push(group.join('；'));
      group = [identity];
      length = identity.length;
    }
    group.push(field);
    length += 1 + field.length;
  }
  if (group.length > 1) {
    parts.push(group.join('；'));
  }
  return parts.length ? parts : [line];
}

function splitPlain(line: string, size: number, overlap: number): string[] {
  const parts: string[] = [];
  let start = 0;
  while (start < line.length) {
    let end = Math.min(line.length, start + size);
    if (end < line.length) {
      const window = line.slice(start, end);
      const breakAt = Math.max(window.lastIndexOf('。'), window.lastIndexOf('. '));
      if (breakAt > size * 0.4) {
        end = start + breakAt + 1;
      }
    }
    const piece = line.slice(start, end).trim();
    if (piece) {
      parts.push(piece);
    }
    if (end >= line.length) {
      break;
    }
    start = Math.max(0, end - overlap);
  }
  return parts;
}
