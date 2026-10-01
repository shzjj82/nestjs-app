import {
  BadRequestException,
  Controller,
  Post,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AGENTS_CLIENT, MQTT_PATTERNS, UPLOAD_CLIENT, unwrapData } from '@app/common';
import type { Request } from 'express';
import { BizGuard } from '../auth/biz.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { GatewayUser } from '../auth/auth.types';
import { ClientHub } from '../mqtt/client.hub';

const VISION_MAX_BYTES = 8 * 1024 * 1024;
const VISION_MAX_FILES = 9;

type Uploaded = {
  images?: Express.Multer.File[];
  image?: Express.Multer.File[];
};

@Controller('agents')
export class VisionOverrideController {
  constructor(
    private readonly clients: ClientHub,
    private readonly biz: BizGuard,
  ) {}

  @Post('vision')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'images', maxCount: VISION_MAX_FILES },
        { name: 'image', maxCount: 1 },
      ],
      {
        storage: memoryStorage(),
        limits: { fileSize: VISION_MAX_BYTES, files: VISION_MAX_FILES },
      },
    ),
  )
  async parse(
    @Req() req: Request,
    @UploadedFiles() files: Uploaded | undefined,
    @CurrentUser() user: GatewayUser,
  ) {
    const bizCode = await this.biz.checkRequest(req, user);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    const text = typeof body.text === 'string' ? body.text : undefined;
    if (!prompt) {
      throw new BadRequestException('请提供提示词 prompt');
    }
    const images = [...(files?.images ?? []), ...(files?.image ?? [])].slice(0, VISION_MAX_FILES);
    if (!images.length && !text?.trim()) {
      throw new BadRequestException('请上传图片或提供文本');
    }

    const uploaded: Array<{ url: string; key: string }> = [];
    for (const file of images) {
      if (!file.buffer?.length) continue;
      const raw = await this.clients.send<{ url: string; key: string }>(
        UPLOAD_CLIENT,
        MQTT_PATTERNS.UPLOAD_PUT,
        {
          filename: file.originalname || 'image.jpg',
          contentType: file.mimetype || 'image/jpeg',
          prefix: 'vision',
          base64: file.buffer.toString('base64'),
          _bizCode: bizCode,
        },
      );
      const stored = unwrapData<{ url: string; key: string }>(raw);
      uploaded.push({ url: stored.url, key: stored.key });
    }

    return this.clients.send(
      AGENTS_CLIENT,
      MQTT_PATTERNS.AGENTS_VISION_PARSE,
      {
        prompt,
        text,
        imageUrls: uploaded.map((item) => item.url),
        imageKeys: uploaded.map((item) => item.key),
        _bizCode: bizCode,
        _session: {
          accountId: user.accountId,
          appId: user.appId,
          bizCode: user.bizCode ?? bizCode ?? '',
        },
      },
      visionTimeoutMs(),
    );
  }
}

function visionTimeoutMs() {
  const n = Number(process.env.AGENTS_VISION_TIMEOUT_MS ?? 120_000);
  return Number.isFinite(n) && n > 0 ? n : 120_000;
}
