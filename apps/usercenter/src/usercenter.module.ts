import { Module } from '@nestjs/common';
import { ApiDocsModule, MQTT_GROUPS, MQTT_PATTERNS, RedisInfraModule, sharePattern } from '@app/common';
import { AppsModule } from './apps/apps.module';
import { AuthModule } from './auth/auth.module';
import { BusinessesModule } from './businesses/businesses.module';
import { DatabaseModule } from './database/database.module';
import { RbacModule } from './rbac/rbac.module';
import { UsercenterController } from './usercenter.controller';
import { UsercenterService } from './usercenter.service';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    DatabaseModule,
    RedisInfraModule,
    BusinessesModule,
    AppsModule,
    UsersModule,
    AuthModule,
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
