import ExcelJS from 'exceljs';
import { Logger } from '@nestjs/common';
import { embeddedImages, type EmbeddedImage } from './embedded-images';
import type { ExtractedAttachment } from './editorjs-text';
import { mapPool } from '../../../support/map-pool';
import {
  applyMerges,
  decodeTabularBuffer,
  formatLabeledTable,
  parseDelimitedTable,
} from './table-text';

const logger = new Logger('AgentsRagAttach');

/** 运行时 require，避免 Nest webpack 去打包 pdf-parse/mammoth（二者对 bundler 不友好） */
function nodeRequire(id: string): unknown {
  // eslint-disable-next-line no-eval, @typescript-eslint/no-unsafe-call
  return eval('require')(id);
}

/** 尽力从 OSS 公开 URL 抽取附件文本；失败则跳过 */
export async function extractAttachmentTexts(
  files: ExtractedAttachment[],
  recognizeImages?: (images: EmbeddedImage[]) => Promise<string[]>,
): Promise<Array<{ name: string; url: string; ext: string; text: string }>> {
  const extracted = await mapPool(files.slice(0, 8), 4, async (file) => {
    try {
      const text = await extractOne(file, recognizeImages);
      const trimmed = text.trim();
      if (!trimmed) {
        return null;
      }
      return { ...file, text: trimmed.slice(0, 80_000) };
    } catch (err) {
      logger.warn(
        `skip attachment ${file.name}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  });
  return extracted.filter((item) => item !== null);
}

async function extractOne(
  file: ExtractedAttachment,
  recognizeImages?: (images: EmbeddedImage[]) => Promise<string[]>,
): Promise<string> {
  const res = await fetch(file.url, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const text = await textOf(file.ext, buf, file.name);
  const images = await embeddedImages(buf, file.ext).catch(() => []);
  const recognized = images.length && recognizeImages ? await recognizeImages(images) : [];
  const pictureText = recognized.filter(Boolean).join('\n\n');
  return [text, pictureText ? `【文件内图片】\n${pictureText}` : ''].filter(Boolean).join('\n\n');
}

async function textOf(ext: string, buf: Buffer, name = ''): Promise<string> {
  switch (ext) {
    case 'txt':
      return buf.toString('utf8');
    case 'csv':
      return formatLabeledTable(tableName(name, '表格'), parseDelimitedTable(decodeTabularBuffer(buf)));
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
    convertToHtml: (input: { buffer: Buffer }) => Promise<{ value?: string }>;
  };
  const result = await mammoth.convertToHtml({ buffer: buf });
  return htmlWithTables(String(result.value ?? ''));
}

async function extractExcel(buf: Buffer): Promise<string> {
  const wb = new ExcelJS.Workbook();
  // ExcelJS 类型对 Buffer 偏严，运行时可用
  await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
  const parts: string[] = [];
  for (const sheet of wb.worksheets) {
    const rows = new Map<number, string[]>();
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const values = row.values as unknown[];
      const width = Math.max(sheet.columnCount, values.length - 1);
      const cells: string[] = [];
      for (let index = 1; index <= width; index += 1) {
        cells.push(cellText(values[index]));
      }
      while (cells.length > 1 && !cells[cells.length - 1]) {
        cells.pop();
      }
      if (cells.some(Boolean)) {
        rows.set(row.number, cells);
      }
    });
    const labeled = formatLabeledTable(sheet.name || '表格', applyMerges(rows, sheetMerges(sheet)));
    if (labeled) {
      parts.push(labeled);
    }
  }
  return parts.join('\n\n');
}

/** 用第一行当表头，后面每一行写成「列名：值」，空列留在原位。 */
export function labeledSheet(name: string, rows: string[][]): string {
  return formatLabeledTable(name, rows);
}

function tableName(name: string, fallback: string): string {
  const base = name.replace(/\.[^.]+$/, '').trim();
  return base || fallback;
}

function sheetMerges(sheet: ExcelJS.Worksheet): string[] {
  const model = (sheet as ExcelJS.Worksheet & { model?: { merges?: string[] } }).model;
  return Array.isArray(model?.merges) ? model.merges : [];
}

function htmlWithTables(html: string): string {
  const withTables = html.replace(/<table\b[\s\S]*?<\/table>/gi, (table) => {
    const rows = [...table.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)].map((tr) =>
      [...tr[0].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) =>
        stripTags(cell[1]),
      ),
    );
    const labeled = formatLabeledTable('文档表格', rows);
    return labeled ? `\n${labeled}\n` : '';
  });
  return stripTags(withTables).replace(/\n{3,}/g, '\n\n').trim();
}

function stripTags(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function cellText(cell: unknown): string {
  if (cell == null) {
    return '';
  }
  if (cell instanceof Date) {
    return cell.toISOString().slice(0, 10);
  }
  if (typeof cell === 'string' || typeof cell === 'number' || typeof cell === 'boolean') {
    return String(cell).trim();
  }
  if (typeof cell === 'object') {
    const record = cell as {
      text?: unknown;
      result?: unknown;
      richText?: Array<{ text?: unknown }>;
    };
    if (Array.isArray(record.richText)) {
      return record.richText.map((part) => String(part.text ?? '')).join('').trim();
    }
    if ('result' in record && record.result != null) {
      return cellText(record.result);
    }
    if ('text' in record) {
      return cellText(record.text);
    }
  }
  return '';
}
