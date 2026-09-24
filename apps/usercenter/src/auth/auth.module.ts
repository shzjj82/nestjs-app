import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisInfraModule } from '@app/common';
import { AppsModule } from '../apps/apps.module';
import { SharedModule } from '../common/shared.module';
import { UserIdentityEntity } from '../entities';
import { RbacModule } from '../rbac/rbac.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AlipayClient } from './alipay.client';
import { AuthService } from './auth.service';
import { WechatClient } from './wechat.client';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserIdentityEntity]),
    RedisInfraModule,
    AppsModule,
    UsersModule,
    RbacModule,
    SharedModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, WechatClient, AlipayClient],
  exports: [AuthService],
})
export class AuthModule {}
