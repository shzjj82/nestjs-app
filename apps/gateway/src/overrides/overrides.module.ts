import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MqttModule } from '../mqtt/mqtt.module';
import { OrdersOverrideController } from './orders.controller';
import { PermissionsFileController } from './permissions-file.controller';

@Module({
  imports: [AuthModule, MqttModule],
  controllers: [OrdersOverrideController, PermissionsFileController],
})
export class OverridesModule {}
