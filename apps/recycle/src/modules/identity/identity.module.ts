import { forwardRef, Global, Module } from '@nestjs/common';
import { StoresModule } from '../stores/stores.module';
import { IdentityController } from './identity.controller';
import { IdentityService } from './identity.service';
import { LiveRolesService } from './live-roles.service';

@Global()
@Module({
  imports: [forwardRef(() => StoresModule)],
  controllers: [IdentityController],
  providers: [IdentityService, LiveRolesService],
  exports: [IdentityService, LiveRolesService],
})
export class IdentityModule {}
