import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import {
  BadRequestException,
  Controller,
  Post,
  Req,
  ServiceUnavailableException,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { memoryStorage } from 'multer';
import {
  MEDICAL_CLIENT,
  MQTT_PATTERNS,
  uploadStorageConfig,
  uploadStorageReady,
  type UploadStorageConfig,
} from '@app/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { BizGuard } from '../auth/biz.guard';
import { ClientHub } from '../mqtt/client.hub';

const TONGUE_MAX_BYTES = 5 * 1024 * 1024;
const ASSIST_MAX_BYTES = 10 * 1024 * 1024;
/** 超过同步识别上限的音频走这里，直接写入对象存储，不经 MQTT。 */
const AUDIO_MAX_BYTES = 100 * 1024 * 1024;

/**
 * 舌象走 multipart，和 POST /upload 一样。
 * MQTT 仍只能带 JSON，网关在这里把 file 转成 base64 再交给 medical。
 */
@Controller('medical/files')
export class MedicalTongueOverrideController {
  private audioClient: { client: S3Client; config: UploadStorageConfig } | null = null;

  constructor(
    private readonly clients: ClientHub,
    private readonly auth: AuthService,
    private readonly biz: BizGuard,
  ) {}

  @Post('tongue')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: TONGUE_MAX_BYTES },
    }),
  )
  async tongue(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    const bizCode = await this.biz.checkRequest(req, null);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const fromFile = file?.buffer?.length
      ? {
          imageBase64: file.buffer.toString('base64'),
          mime: file.mimetype || 'image/jpeg',
          name: String(body.name ?? file.originalname ?? '舌象'),
        }
      : null;
    const fromJson = !fromFile
      ? {
          imageBase64: typeof body.imageBase64 === 'string' ? body.imageBase64 : '',
          mime: typeof body.mime === 'string' ? body.mime : 'image/jpeg',
          name: typeof body.name === 'string' ? body.name : '舌象',
        }
      : null;
    const payload = fromFile ?? fromJson;
    if (!payload?.imageBase64) {
      throw new BadRequestException('请上传图片，字段名 file');
    }
    return this.clients.send(MEDICAL_CLIENT, MQTT_PATTERNS.MEDICAL_FILE_TONGUE, {
      ...payload,
      _token: this.auth.bearerToken(req),
      _bizCode: bizCode,
    });
  }

  @Post('assist')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: ASSIST_MAX_BYTES },
    }),
  )
  async assist(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    const bizCode = await this.biz.checkRequest(req, null);
    if (!file?.buffer?.length) {
      throw new BadRequestException('请上传文件，字段名 file');
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    return this.clients.send(MEDICAL_CLIENT, MQTT_PATTERNS.MEDICAL_FILE_ASSIST, {
      fileBase64: file.buffer.toString('base64'),
      mime: file.mimetype || 'application/octet-stream',
      name: String(body.name ?? file.originalname ?? '素材'),
      _token: this.auth.bearerToken(req),
      _bizCode: bizCode,
    });
  }

  /** 长音频直传对象存储。短录音仍走 /ai/intake-audio 的 base64。 */
  @Post('audio')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: AUDIO_MAX_BYTES },
    }),
  )
  async audio(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!verifyClinicToken(this.auth.bearerToken(req))) {
      throw new UnauthorizedException('请先登录');
    }
    await this.biz.checkRequest(req, null);
    if (!file?.buffer?.length) {
      throw new BadRequestException('请上传音频，字段名 file');
    }
    const name = file.originalname || 'audio';
    const mime = file.mimetype || 'application/octet-stream';
    if (!mime.startsWith('audio/') && !/\.(webm|wav|mp3|m4a|ogg|aac|flac)$/i.test(name)) {
      throw new BadRequestException('请上传音频文件');
    }
    const { client, config } = this.audioStorage();
    const key = audioObjectKey(name);
    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: mime,
        ContentLength: file.buffer.length,
      }),
    );
    const base = name.replace(/\.[^.]+$/, '').replace(/[^\w.\-\u4e00-\u9fff]+/g, '').slice(0, 80) || 'audio';
    const ext = key.split('.').pop() || 'bin';
    return { url: publicObjectUrl(config, key), name: `${base}.${ext}`, key };
  }

  private audioStorage(): { client: S3Client; config: UploadStorageConfig } {
    if (this.audioClient) return this.audioClient;
    const config = uploadStorageConfig();
    if (!uploadStorageReady(config)) {
      throw new ServiceUnavailableException('上传存储未配置');
    }
    this.audioClient = {
      config,
      client: new S3Client({
        region: config.region || 'us-east-1',
        endpoint: config.endpoint,
        forcePathStyle: config.forcePathStyle,
        credentials: {
          accessKeyId: config.accessKey,
          secretAccessKey: config.secretKey,
        },
        // OSS 不接受 AWS 分块校验头
        requestChecksumCalculation: 'WHEN_REQUIRED' as 'WHEN_REQUIRED',
        responseChecksumValidation: 'WHEN_REQUIRED' as 'WHEN_REQUIRED',
      }),
    };
    return this.audioClient;
  }
}

function verifyClinicToken(token: string | null): boolean {
  if (!token) return false;
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac('sha256', process.env.AUTH_SECRET ?? 'tcm-dev-auth-secret-change-me')
    .update(payload)
    .digest('base64url');
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { exp?: number; role?: string };
    return Boolean(data.exp && data.exp > Date.now() && (data.role === 'doctor' || data.role === 'assistant'));
  } catch {
    return false;
  }
}

function audioObjectKey(filename: string): string {
  const extMatch = filename.toLowerCase().match(/\.([a-z0-9]{2,5})$/);
  const ext = extMatch?.[1] && /^(webm|wav|mp3|m4a|ogg|aac|flac)$/.test(extMatch[1]) ? extMatch[1] : 'mp3';
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `medical/audio/${y}/${m}/${d}/${randomUUID()}.${ext}`;
}

function publicObjectUrl(config: UploadStorageConfig, key: string): string {
  if (config.publicBase) return `${config.publicBase.replace(/\/+$/, '')}/${key}`;
  const endpoint = config.endpoint.replace(/\/+$/, '');
  if (config.forcePathStyle) return `${endpoint}/${config.bucket}/${key}`;
  try {
    const url = new URL(endpoint);
    return `${url.protocol}//${config.bucket}.${url.host}/${key}`;
  } catch {
    return `${endpoint}/${config.bucket}/${key}`;
  }
}
