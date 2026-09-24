import { randomUUID } from 'crypto';

export function objectKey(prefix: string, filename: string): string {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80) || 'file';
  const extMatch = safeName.match(/(\.[a-zA-Z0-9]{1,8})$/);
  const ext = extMatch?.[1] ?? '';
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const cleaned = prefix
    .replace(/^\/+|\/+$/g, '')
    .replace(/\.\./g, '')
    .replace(/[^a-zA-Z0-9/_-]+/g, '-');
  const dir = cleaned ? `${cleaned}/` : '';
  return `${dir}${y}/${m}/${d}/${randomUUID()}${ext}`;
}
