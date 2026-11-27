import { Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';
import { UPLOAD_CLIENT, mqttClientOptions } from '@app/common';
import { WikiUploadController } from './upload.controller';
import { WikiUploadService } from './upload.service';

@Module({
  imports: [
    ClientsModule.register([{ name: UPLOAD_CLIENT, ...mqttClientOptions('wiki-upload') }]),
  ],
  controllers: [WikiUploadController],
  providers: [WikiUploadService],
})
export class UploadModule {}
