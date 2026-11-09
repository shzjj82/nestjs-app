import { Controller, Get, HttpException } from '@nestjs/common';

@Controller('notifications')
export class NotifySocketController {
  @Get('socket')
  hint() {
    throw new HttpException('请使用 WebSocket 连接 /notifications/socket', 426);
  }
}
