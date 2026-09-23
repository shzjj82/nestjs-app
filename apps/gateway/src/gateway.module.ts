import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { MqttModule } from './mqtt/mqtt.module';
import { OverridesModule } from './overrides/overrides.module';
import { ProxyModule } from './proxy/proxy.module';

@Module({
  imports: [MqttModule, AuthModule, ProxyModule, HealthModule, OverridesModule],
})
export class GatewayModule {}
