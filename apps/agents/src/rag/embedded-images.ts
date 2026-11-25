const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp']);
const MAX_IMAGES = 8;
const MAX_BYTES = 6_000_000;
const MIN_BYTES = 256;

export type EmbeddedImage = {
  name: string;
  mime: string;
  bytes: Buffer;
};

function nodeRequire(id: string): unknown {
  // eslint-disable-next-line no-eval, @typescript-eslint/no-unsafe-call
  return eval('require')(id);
}

const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
};

/** docx / xlsx 压缩包里的图片，以及 PDF 里直接嵌入的 JPEG、PNG。 */
export async function embeddedImages(buf: Buffer, ext: string): Promise<EmbeddedImage[]> {
  if (ext === 'docx' || ext === 'xlsx') {
    return imagesInZip(buf);
  }
  if (ext === 'pdf') {
    return imagesInPdf(buf);
  }
  return [];
}

async function imagesInZip(buf: Buffer): Promise<EmbeddedImage[]> {
  const JSZip = nodeRequire('jszip') as {
    loadAsync: (data: Buffer) => Promise<{
      files: Record<string, { dir: boolean; async: (type: 'nodebuffer') => Promise<Buffer> }>;
    }>;
  };
  const zip = await JSZip.loadAsync(buf);
  const out: EmbeddedImage[] = [];
  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir || out.length >= MAX_IMAGES) {
      continue;
    }
    const name = path.split('/').pop() ?? path;
    const fileExt = name.split('.').pop()?.toLowerCase() ?? '';
    if (!IMAGE_EXT.has(fileExt)) {
      continue;
    }
    const bytes = await entry.async('nodebuffer');
    pushImage(out, name, fileExt, bytes);
  }
  return out;
}

function imagesInPdf(buf: Buffer): EmbeddedImage[] {
  const out: EmbeddedImage[] = [];
  collectJpeg(buf, out);
  collectPng(buf, out);
  return out;
}

function collectJpeg(buf: Buffer, out: EmbeddedImage[]) {
  let from = 0;
  while (out.length < MAX_IMAGES) {
    const start = buf.indexOf(Buffer.from([0xff, 0xd8, 0xff]), from);
    if (start < 0) {
      return;
    }
    const end = buf.indexOf(Buffer.from([0xff, 0xd9]), start + 3);
    if (end < 0) {
      return;
    }
    pushImage(out, `page-${out.length + 1}.jpg`, 'jpg', buf.subarray(start, end + 2));
    from = end + 2;
  }
}

function collectPng(buf: Buffer, out: EmbeddedImage[]) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const iend = Buffer.from([0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
  let from = 0;
  while (out.length < MAX_IMAGES) {
    const start = buf.indexOf(signature, from);
    if (start < 0) {
      return;
    }
    const end = buf.indexOf(iend, start + signature.length);
    if (end < 0) {
      return;
    }
    pushImage(out, `page-${out.length + 1}.png`, 'png', buf.subarray(start, end + iend.length));
    from = end + iend.length;
  }
}

function pushImage(out: EmbeddedImage[], name: string, ext: string, bytes: Buffer) {
  if (bytes.length < MIN_BYTES || bytes.length > MAX_BYTES || out.length >= MAX_IMAGES) {
    return;
  }
  out.push({
    name,
    mime: MIME[ext] ?? 'application/octet-stream',
    bytes: Buffer.from(bytes),
  });
}
