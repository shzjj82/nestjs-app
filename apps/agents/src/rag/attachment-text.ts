import ExcelJS from 'exceljs';
import { Logger } from '@nestjs/common';
import type { ExtractedAttachment } from './editorjs-text';

const logger = new Logger('AgentsRagAttach');

/** 运行时 require，避免 Nest webpack 去打包 pdf-parse/mammoth（二者对 bundler 不友好） */
function nodeRequire(id: string): unknown {
  // eslint-disable-next-line no-eval, @typescript-eslint/no-unsafe-call
  return eval('require')(id);
}

/** 尽力从 OSS 公开 URL 抽取附件文本；失败则跳过 */
export async function extractAttachmentTexts(
  files: ExtractedAttachment[],
): Promise<Array<{ name: string; url: string; ext: string; text: string }>> {
  const out: Array<{ name: string; url: string; ext: string; text: string }> = [];
  for (const file of files.slice(0, 8)) {
    try {
      const text = await extractOne(file);
      if (text.trim()) {
        out.push({ ...file, text: text.trim().slice(0, 80_000) });
      }
    } catch (err) {
      logger.warn(
        `skip attachment ${file.name}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  return out;
}

async function extractOne(file: ExtractedAttachment): Promise<string> {
  const res = await fetch(file.url, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  switch (file.ext) {
    case 'txt':
    case 'csv':
      return buf.toString('utf8');
    case 'pdf':
      return extractPdf(buf);
    case 'doc':
    case 'docx':
      return extractDocx(buf);
    case 'xls':
    case 'xlsx':
      return extractExcel(buf);
    default:
      return '';
  }
}

async function extractPdf(buf: Buffer): Promise<string> {
  const pdfParse = nodeRequire('pdf-parse') as (data: Buffer) => Promise<{ text?: string }>;
  const result = await pdfParse(buf);
  return String(result.text ?? '');
}

async function extractDocx(buf: Buffer): Promise<string> {
  const mammoth = nodeRequire('mammoth') as {
    extractRawText: (input: { buffer: Buffer }) => Promise<{ value?: string }>;
  };
  const result = await mammoth.extractRawText({ buffer: buf });
  return String(result.value ?? '');
}

async function extractExcel(buf: Buffer): Promise<string> {
  const wb = new ExcelJS.Workbook();
  // ExcelJS 类型对 Buffer 偏严，运行时可用
  await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
  const parts: string[] = [];
  for (const sheet of wb.worksheets) {
    const rows: string[] = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const cells = (row.values as unknown[])
        .slice(1)
        .map((cell) => cellText(cell))
        .filter(Boolean);
      if (cells.length) {
        rows.push(cells.join('\t'));
      }
    });
    if (rows.length) {
      parts.push(`【表：${sheet.name}】\n${rows.slice(0, 200).join('\n')}`);
    }
  }
  return parts.join('\n\n');
}

function cellText(cell: unknown): string {
  if (cell == null) {
    return '';
  }
  if (typeof cell === 'string' || typeof cell === 'number' || typeof cell === 'boolean') {
    return String(cell);
  }
  if (typeof cell === 'object' && cell && 'text' in cell) {
    return String((cell as { text: unknown }).text ?? '');
  }
  if (typeof cell === 'object' && cell && 'result' in cell) {
    return String((cell as { result: unknown }).result ?? '');
  }
  return String(cell);
}
