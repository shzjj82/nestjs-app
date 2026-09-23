import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MqttModule } from '../mqtt/mqtt.module';
import { OrdersOverrideController } from './orders.controller';

@Module({
  imports: [AuthModule, MqttModule],
  controllers: [OrdersOverrideController],
})
export class OverridesModule {}
