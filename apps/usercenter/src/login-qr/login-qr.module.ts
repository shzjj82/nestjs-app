import { Module } from '@nestjs/common';
import { RedisInfraModule } from '@app/common';
import { AuthModule } from '../auth/auth.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { AccessClientsModule } from '../clients/clients.module';
import { LoginQrController } from './login-qr.controller';
import { LoginQrService } from './login-qr.service';

@Module({
  imports: [RedisInfraModule, AccessClientsModule, BusinessesModule, AuthModule],
  controllers: [LoginQrController],
  providers: [LoginQrService],
  exports: [LoginQrService],
})
export class LoginQrModule {}
