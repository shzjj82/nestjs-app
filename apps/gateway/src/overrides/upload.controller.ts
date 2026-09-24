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
import {
  MQTT_PATTERNS,
  UPLOAD_CLIENT,
  uploadMaxBytes,
} from '@app/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { ClientHub } from '../mqtt/client.hub';

@Controller('upload')
export class UploadOverrideController {
  constructor(
    private readonly clients: ClientHub,
    private readonly auth: AuthService,
  ) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: uploadMaxBytes() },
    }),
  )
  async put(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    await this.auth.enforce(['jwt', 'upload-key'], req);
    return this.clients.send(
      UPLOAD_CLIENT,
      MQTT_PATTERNS.UPLOAD_PUT,
      this.filePayload(req, file),
    );
  }

  @Post('async')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: uploadMaxBytes() },
    }),
  )
  async enqueue(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    await this.auth.enforce(['jwt', 'upload-key'], req);
    return this.clients.send(
      UPLOAD_CLIENT,
      MQTT_PATTERNS.UPLOAD_ENQUEUE,
      this.filePayload(req, file),
    );
  }

  private filePayload(req: Request, file: Express.Multer.File | undefined) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('请上传文件，字段名 file');
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    return {
      filename: String(body.filename ?? file.originalname ?? 'file'),
      contentType: String(body.contentType ?? file.mimetype ?? 'application/octet-stream'),
      prefix: typeof body.prefix === 'string' ? body.prefix : '',
      base64: file.buffer.toString('base64'),
    };
  }
}
