import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { InboxController } from './inbox.controller';
import { NoticesService } from './notices.service';
import { SendController } from './send.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [InboxController, SendController],
  providers: [NoticesService],
  exports: [NoticesService],
})
export class NoticesModule {}
