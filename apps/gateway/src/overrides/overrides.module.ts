import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MqttModule } from '../mqtt/mqtt.module';
import { AgentsOverrideController } from './agents.controller';
import { BizModulesController } from './biz-modules.controller';
import { OrdersOverrideController } from './orders.controller';
import { VisionOverrideController } from './vision.controller';
import { PermissionsFileController } from './permissions-file.controller';
import { UploadOverrideController } from './upload.controller';
import { LoginQrEventsController } from './login-qr-events.controller';
import { MedicalChatOverrideController } from './medical-chat.controller';
import { MedicalTongueOverrideController } from './medical-tongue.controller';
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
    LoginQrEventsController,
    MedicalTongueOverrideController,
    MedicalChatOverrideController,
  ],
})
export class OverridesModule {}
