import { Module } from '@nestjs/common';
import { RedisInfraModule } from '@app/common';
import { AppsModule } from './apps/apps.module';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { RbacModule } from './rbac/rbac.module';
import { UsercenterController } from './usercenter.controller';
import { UsercenterService } from './usercenter.service';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    DatabaseModule,
    RedisInfraModule,
    AppsModule,
    UsersModule,
    AuthModule,
    RbacModule,
  ],
  controllers: [UsercenterController],
  providers: [UsercenterService],
})
export class UsercenterModule {}
