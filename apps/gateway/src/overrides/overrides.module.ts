import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MqttModule } from '../mqtt/mqtt.module';
import { AgentsOverrideController } from './agents.controller';
import { BizModulesController } from './biz-modules.controller';
import { OrdersOverrideController } from './orders.controller';
import { VisionOverrideController } from './vision.controller';
import { PermissionsFileController } from './permissions-file.controller';
import { UploadOverrideController } from './upload.controller';
import { WechatQrcodeController } from './wechat-qrcode.controller';

@Module({
  imports: [AuthModule, MqttModule],
  controllers: [
    AgentsOverrideController,
    BizModulesController,
    OrdersOverrideController,
    VisionOverrideController,
    PermissionsFileController,
    UploadOverrideController,
    WechatQrcodeController,
  ],
})
export class OverridesModule {}
