import { Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { MqttModule } from './modules/mqtt/mqtt.module';
import { OverridesModule } from './modules/overrides/overrides.module';
import { ProxyModule } from './modules/proxy/proxy.module';

@Module({
  imports: [MqttModule, AuthModule, ProxyModule, HealthModule, OverridesModule],
})
export class GatewayModule {}
