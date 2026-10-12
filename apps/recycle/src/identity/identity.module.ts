import { Inject, Module, OnModuleInit } from '@nestjs/common';
import { ClientProxy, ClientsModule } from '@nestjs/microservices';
import { mqttClientOptions, USER_CLIENT } from '@app/common';
import { StoresModule } from '../stores/stores.module';
import { IdentityService } from './identity.service';

@Module({
  imports: [
    StoresModule,
    ClientsModule.register([
      {
        name: USER_CLIENT,
        ...mqttClientOptions('recycle-identity-to-user'),
      },
    ]),
  ],
  providers: [IdentityService],
  exports: [IdentityService],
})
export class IdentityModule implements OnModuleInit {
  constructor(@Inject(USER_CLIENT) private readonly users: ClientProxy) {}

  async onModuleInit() {
    await this.users.connect();
  }
}
