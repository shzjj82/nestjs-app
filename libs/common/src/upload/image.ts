/** 微信 getwxacodeunlimit 等接口常返回 JPEG，以 base64 魔数为准 */
export function sniffImageMime(base64: string, fallback = 'image/png'): string {
  if (base64.startsWith('/9j/')) return 'image/jpeg';
  if (base64.startsWith('iVBOR')) return 'image/png';
  if (base64.startsWith('R0lGOD')) return 'image/gif';
  if (base64.startsWith('UklGR')) return 'image/webp';
  return fallback || 'image/png';
}

export function imageExtForMime(mime: string): string {
  if (mime === 'image/jpeg') return '.jpg';
  if (mime === 'image/png') return '.png';
  if (mime === 'image/gif') return '.gif';
  if (mime === 'image/webp') return '.webp';
  return '';
}

/** 按 mime 拼文件名；无法识别扩展名时回退 fallback */
export function qrImageFilename(
  stem: string,
  mime: string,
  fallback: string,
): string {
  const ext = imageExtForMime(mime);
  if (ext) {
    return `${stem}${ext}`;
  }
  return fallback || `${stem}.png`;
}
