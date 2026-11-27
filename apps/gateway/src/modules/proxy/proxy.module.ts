import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MqttModule } from '../mqtt/mqtt.module';
import { ProxyMiddleware } from './proxy.middleware';
import { PROXY_HTTP_PATHS } from './proxy.routes';

@Module({
  imports: [AuthModule, MqttModule],
  providers: [ProxyMiddleware],
})
export class ProxyModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ProxyMiddleware).forRoutes(...PROXY_HTTP_PATHS);
  }
}
