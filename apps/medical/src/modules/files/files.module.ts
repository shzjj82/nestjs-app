import { Module } from '@nestjs/common';
import { UploadClient } from '@app/common';
import { AuthModule } from '../auth/auth.module';
import { FilesController } from './files.controller';

@Module({
  imports: [AuthModule],
  controllers: [FilesController],
  providers: [UploadClient],
})
export class FilesModule {}
