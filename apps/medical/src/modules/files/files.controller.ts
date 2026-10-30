import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import {
  ApiDoc,
  MQTT_GROUPS,
  MQTT_PATTERNS,
  optionalString,
  rpcFail,
  sharePattern,
} from '@app/common';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { requireClinic } from '../../clinic';
import { AuthService } from '../auth/auth.service';

const DIR = join(process.cwd(), 'uploads', 'tongues');

@Controller()
export class FilesController {
  constructor(private readonly auth: AuthService) {}

  @MessagePattern(
    sharePattern(MQTT_GROUPS.MEDICAL, MQTT_PATTERNS.MEDICAL_FILE_TONGUE),
  )
  @ApiDoc({
    name: '上传舌象',
    description: 'JSON base64 落本地；MQTT 不适合回传文件流，请用返回的 url 自行取图',
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
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    mkdirSync(DIR, { recursive: true });
    writeFileSync(join(DIR, id), bytes);
    const name =
      (optionalString(payload.name) || '舌象')
        .replace(/[^\w.\-\u4e00-\u9fff]+/g, '')
        .slice(0, 80) || '舌象';
    return { url: `/medical/files/tongues/${id}`, name };
  }
}
