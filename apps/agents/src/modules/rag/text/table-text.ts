/** 把表格写成「列名：值」，每一行是一条完整记录。 */

export function formatLabeledTable(
  name: string,
  rows: string[][],
  opts?: { headings?: boolean },
): string {
  const cleaned = rows
    .map((row) => trimTrailingEmpty(row.map((cell) => cell.trim())))
    .filter((row) => row.some(Boolean));
  if (!cleaned.length) {
    return '';
  }
  const headings = opts?.headings !== false;
  let title = '';
  let headerAt = 0;
  if (headings && cleaned.length >= 2) {
    const firstFilled = cleaned[0].filter(Boolean);
    const secondFilled = (cleaned[1] ?? []).filter(Boolean).length;
    if (firstFilled.length === 1 && secondFilled >= 2) {
      title = firstFilled[0];
      headerAt = 1;
    }
  }
  const headerRow = headings ? cleaned[headerAt] : columnNames(widest(cleaned));
  const body = headings ? cleaned.slice(headerAt + 1, headerAt + 501) : cleaned.slice(0, 500);
  const banner = title ? `【表：${name} · ${title}】` : `【表：${name}】`;
  if (!body.length) {
    return `${banner}\n${headerRow.join(' | ')}`;
  }
  const names = headerRow.map((header, index) => header || `列${index + 1}`);
  const lines = body.map((row) =>
    names.map((header, index) => `${header}：${row[index] ?? ''}`).join('；'),
  );
  return `${banner}\n${lines.join('\n')}`;
}

export function decodeTabularBuffer(buf: Buffer): string {
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return buf.subarray(3).toString('utf8');
  }
  const utf8 = buf.toString('utf8');
  if (!utf8.includes('\uFFFD')) {
    return utf8;
  }
  try {
    return new TextDecoder('gbk').decode(buf);
  } catch {
    return utf8;
  }
}

export function parseDelimitedTable(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!source.trim()) {
    return [];
  }
  const delimiter = detectDelimiter(source);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let index = 0; index < source.length; index += 1) {
    const ch = source[index];
    if (inQuotes) {
      if (ch === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === delimiter) {
      row.push(cell.trim());
      cell = '';
      continue;
    }
    if (ch === '\n') {
      row.push(cell.trim());
      if (row.some(Boolean)) {
        rows.push(row);
      }
      row = [];
      cell = '';
      continue;
    }
    cell += ch;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) {
    rows.push(row);
  }
  return rows;
}

/** 把合并单元格的值填进范围内每一个空格，列位置保持不变。 */
export function applyMerges(rows: Map<number, string[]>, merges: string[]): string[][] {
  for (const range of merges) {
    const [rawStart, rawEnd] = range.split(':');
    if (!rawStart || !rawEnd) {
      continue;
    }
    const start = decodeAddress(rawStart);
    const end = decodeAddress(rawEnd);
    if (!start || !end) {
      continue;
    }
    for (let rowNumber = start.row; rowNumber <= end.row; rowNumber += 1) {
      if (!rows.has(rowNumber)) {
        rows.set(rowNumber, []);
      }
    }
    const value = rows.get(start.row)?.[start.col] ?? '';
    if (!value) {
      continue;
    }
    for (let rowNumber = start.row; rowNumber <= end.row; rowNumber += 1) {
      const row = rows.get(rowNumber) ?? [];
      for (let col = start.col; col <= end.col; col += 1) {
        while (row.length <= col) {
          row.push('');
        }
        if (!row[col]) {
          row[col] = value;
        }
      }
      rows.set(rowNumber, row);
    }
  }
  return [...rows.keys()]
    .sort((left, right) => left - right)
    .map((key) => rows.get(key) ?? []);
}

function detectDelimiter(text: string): string {
  const line = text.split('\n', 1)[0] ?? '';
  const commas = line.split(',').length;
  const tabs = line.split('\t').length;
  return tabs > commas ? '\t' : ',';
}

function columnNames(width: number): string[] {
  return Array.from({ length: width }, (_item, index) => `列${index + 1}`);
}

function widest(rows: string[][]): number {
  return rows.reduce((max, row) => Math.max(max, row.length), 0);
}

function trimTrailingEmpty(row: string[]): string[] {
  const next = [...row];
  while (next.length > 1 && !next[next.length - 1]) {
    next.pop();
  }
  return next;
}

function decodeAddress(address: string): { row: number; col: number } | null {
  const matched = /^([A-Z]+)(\d+)$/i.exec(address.trim());
  if (!matched) {
    return null;
  }
  let col = 0;
  for (const ch of matched[1].toUpperCase()) {
    col = col * 26 + (ch.charCodeAt(0) - 64);
  }
  return { row: Number(matched[2]), col: col - 1 };
}
