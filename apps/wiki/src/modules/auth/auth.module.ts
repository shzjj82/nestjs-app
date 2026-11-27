import { Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';
import { USER_CLIENT, mqttClientOptions } from '@app/common';
import { WikiAuthController } from './auth.controller';
import { WikiAuthService } from './auth.service';

@Module({
  imports: [
    ClientsModule.register([{ name: USER_CLIENT, ...mqttClientOptions('wiki-auth-user') }]),
  ],
  controllers: [WikiAuthController],
  providers: [WikiAuthService],
})
export class AuthModule {}
