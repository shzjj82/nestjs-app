import { Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';
import { mqttClientOptions, RedisInfraModule, WECHAT_CLIENT } from '@app/common';
import { AppsModule } from '../apps/apps.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { RbacModule } from '../rbac/rbac.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AlipayClient } from './alipay.client';
import { AuthService } from './auth.service';
import { WechatClient } from './wechat.client';

@Module({
  imports: [
    RedisInfraModule,
    AppsModule,
    BusinessesModule,
    UsersModule,
    RbacModule,
    ClientsModule.register([
      {
        name: WECHAT_CLIENT,
        ...mqttClientOptions('usercenter-wechat'),
      },
    ]),
  ],
  controllers: [AuthController],
  providers: [AuthService, WechatClient, AlipayClient],
  exports: [AuthService],
})
export class AuthModule {}
