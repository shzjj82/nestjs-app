import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { MQTT_PATTERNS, PERMISSIONS, WECHAT_CLIENT, unwrapData } from '@app/common';
import type { Request, Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthService } from '../auth/auth.service';
import type { GatewayUser } from '../auth/auth.types';
import { ClientHub } from '../mqtt/client.hub';

@Controller('wechat')
export class WechatQrcodeController {
  constructor(
    private readonly clients: ClientHub,
    private readonly auth: AuthService,
  ) {}

  @Post('qrcode')
  @UseGuards(JwtAuthGuard)
  async qrcode(
    @Req() req: Request,
    @CurrentUser() user: GatewayUser,
    @Res() res: Response,
  ) {
    if (!this.auth.hasAnyPermission(user, [PERMISSIONS.WECHAT_QRCODE])) {
      throw new ForbiddenException('缺少权限: wechat.qrcode');
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const file = unwrapData<{
      mime: string;
      filename: string;
      base64: string;
    }>(await this.clients.send(WECHAT_CLIENT, MQTT_PATTERNS.WECHAT_QRCODE, body));
    if (!file?.base64) {
      throw new BadRequestException('未返回小程序码');
    }
    const buffer = Buffer.from(file.base64, 'base64');
    res.setHeader('Content-Type', file.mime || 'image/png');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${file.filename || 'qrcode.png'}"`,
    );
    res.send(buffer);
  }
}
