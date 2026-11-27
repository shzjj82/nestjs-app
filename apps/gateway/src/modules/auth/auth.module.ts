import { Module } from '@nestjs/common';
import { RedisInfraModule } from '@app/common';
import { AuthService } from './auth.service';
import { BizGuard } from './biz.guard';
import { JwtAuthGuard } from './jwt-auth.guard';

@Module({
  imports: [RedisInfraModule],
  providers: [AuthService, JwtAuthGuard, BizGuard],
  exports: [AuthService, JwtAuthGuard, BizGuard],
})
export class AuthModule {}
