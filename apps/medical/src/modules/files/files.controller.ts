import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import {
  ApiDoc,
  MQTT_GROUPS,
  MQTT_PATTERNS,
  optionalString,
  rpcFail,
  sharePattern,
  UploadClient,
} from '@app/common';
import { requireClinic } from '../../clinic';
import { AuthService } from '../auth/auth.service';

@Controller()
export class FilesController {
  constructor(
    private readonly auth: AuthService,
    private readonly upload: UploadClient,
  ) {}

  @MessagePattern(
    sharePattern(MQTT_GROUPS.MEDICAL, MQTT_PATTERNS.MEDICAL_FILE_TONGUE),
  )
  @ApiDoc({
    name: '上传舌象',
    description:
      'HTTP 收 multipart 字段 file；网关转成 base64 后走 MQTT。诊所鉴权通过后内部调 upload 落 OSS。',
  })
  async tongue(payload: Record<string, unknown>) {
    await requireClinic(this.auth, payload);
    const raw = (optionalString(payload.imageBase64) ?? '')
      .replace(/^data:[^,]*,/, '')
      .replace(/\s/g, '');
    if (!raw) rpcFail(400, '没有图片内容');
    const bytes = Buffer.from(raw, 'base64');
    if (!bytes.length) rpcFail(400, '没有图片内容');
    if (bytes.length > 5 * 1024 * 1024) rpcFail(400, '舌象图片请控制在 5MB 以内');
    const mime = (optionalString(payload.mime) ?? '').toLowerCase();
    const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
    const contentType = mime.startsWith('image/')
      ? mime
      : ext === 'png'
        ? 'image/png'
        : ext === 'webp'
          ? 'image/webp'
          : 'image/jpeg';
    const name =
      (optionalString(payload.name) || '舌象')
        .replace(/[^\w.\-\u4e00-\u9fff]+/g, '')
        .slice(0, 80) || '舌象';
    const bizCode = optionalString(payload._bizCode) ?? 'medical';
    const stored = await this.upload.put({
      bizCode,
      filename: `${name}.${ext}`,
      contentType,
      base64: raw,
      prefix: 'tongues',
    });
    return { url: stored.url, name, key: stored.key };
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.MEDICAL, MQTT_PATTERNS.MEDICAL_FILE_ASSIST),
  )
  @ApiDoc({
    name: '上传智能填写素材',
    description: '智能填写时的原始录音或文字文件，multipart 字段 file。',
  })
  async assist(payload: Record<string, unknown>) {
    await requireClinic(this.auth, payload);
    const raw = (optionalString(payload.fileBase64) ?? '')
      .replace(/^data:[^,]*,/, '')
      .replace(/\s/g, '');
    if (!raw) rpcFail(400, '没有文件内容');
    const bytes = Buffer.from(raw, 'base64');
    if (!bytes.length) rpcFail(400, '没有文件内容');
    if (bytes.length > 10 * 1024 * 1024) rpcFail(400, '解析文件请控制在 10MB 以内');
    const mime = (optionalString(payload.mime) ?? 'application/octet-stream').toLowerCase();
    const given = optionalString(payload.name) || '素材';
    const ext = assistExt(given, mime);
    const name = given.replace(/[^\w.\-\u4e00-\u9fff]+/g, '').slice(0, 80) || '素材';
    const base = name.replace(/\.[^.]+$/, '');
    const bizCode = optionalString(payload._bizCode) ?? 'medical';
    const stored = await this.upload.put({
      bizCode,
      filename: `${base}.${ext}`,
      contentType: mime || 'application/octet-stream',
      base64: raw,
      prefix: 'assist',
    });
    return { url: stored.url, name: `${base}.${ext}`, key: stored.key };
  }
}

function assistExt(name: string, mime: string): string {
  const fromName = name.split('.').pop()?.toLowerCase() ?? '';
  if (fromName && fromName !== name.toLowerCase() && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName;
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('mp4') || mime.includes('m4a')) return 'm4a';
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3';
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('markdown')) return 'md';
  if (mime.startsWith('text/')) return 'txt';
  return 'bin';
}
