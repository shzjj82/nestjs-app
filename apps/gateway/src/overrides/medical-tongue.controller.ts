import {
  BadRequestException,
  Controller,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { MEDICAL_CLIENT, MQTT_PATTERNS } from '@app/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { BizGuard } from '../auth/biz.guard';
import { ClientHub } from '../mqtt/client.hub';

const TONGUE_MAX_BYTES = 5 * 1024 * 1024;
const ASSIST_MAX_BYTES = 10 * 1024 * 1024;

/**
 * 舌象走 multipart，和 POST /upload 一样。
 * MQTT 仍只能带 JSON，网关在这里把 file 转成 base64 再交给 medical。
 */
@Controller('medical/files')
export class MedicalTongueOverrideController {
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
}
