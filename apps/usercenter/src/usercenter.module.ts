import { Module } from '@nestjs/common';
import { ApiDocsModule, MQTT_GROUPS, MQTT_PATTERNS, RedisInfraModule, sharePattern } from '@app/common';
import { AccessClientsModule } from './modules/clients/clients.module';
import { AuthModule } from './modules/auth/auth.module';
import { LoginQrModule } from './modules/login-qr/login-qr.module';
import { BusinessesModule } from './modules/businesses/businesses.module';
import { DatabaseModule } from './database/database.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { UsercenterController } from './usercenter.controller';
import { UsercenterService } from './usercenter.service';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    DatabaseModule,
    RedisInfraModule,
    BusinessesModule,
    AccessClientsModule,
    UsersModule,
    AuthModule,
    LoginQrModule,
    RbacModule,
    ApiDocsModule.forService({
      service: 'usercenter',
      label: '用户模块',
      pattern: sharePattern(MQTT_GROUPS.USERCENTER, MQTT_PATTERNS.USER_API_DOCS),
    }),
  ],
  controllers: [UsercenterController],
  providers: [UsercenterService],
})
export class UsercenterModule {}
