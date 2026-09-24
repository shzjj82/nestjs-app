import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { MQTT_PATTERNS, PERMISSIONS, USER_CLIENT, unwrapData } from '@app/common';
import type { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthService } from '../auth/auth.service';
import type { GatewayUser } from '../auth/auth.types';
import { ClientHub } from '../mqtt/client.hub';

@Controller('permissions')
export class PermissionsFileController {
  constructor(
    private readonly clients: ClientHub,
    private readonly auth: AuthService,
  ) {}

  @Get('export')
  @UseGuards(JwtAuthGuard)
  async export(@CurrentUser() user: GatewayUser, @Res() res: Response) {
    if (!this.auth.hasAnyPermission(user, [PERMISSIONS.PERMISSION_EXPORT])) {
      throw new ForbiddenException('缺少权限: permission.export');
    }
    const file = unwrapData<{
      filename: string;
      mime: string;
      base64: string;
    }>(await this.clients.send(USER_CLIENT, MQTT_PATTERNS.PERMISSION_EXPORT, {}));
    const buffer = Buffer.from(file.base64, 'base64');
    res.setHeader('Content-Type', file.mime);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.filename}"`,
    );
    res.send(buffer);
  }

  @Post('import')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async import(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: GatewayUser,
  ) {
    if (!this.auth.hasAnyPermission(user, [PERMISSIONS.PERMISSION_IMPORT])) {
      throw new ForbiddenException('缺少权限: permission.import');
    }
    if (!file?.buffer?.length) {
      throw new BadRequestException('请上传 Excel 文件，字段名 file');
    }
    return this.clients.send(USER_CLIENT, MQTT_PATTERNS.PERMISSION_IMPORT, {
      base64: file.buffer.toString('base64'),
    });
  }
}
