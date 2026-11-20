import { Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';
import {
  AGENTS_CLIENT,
  NOTIFY_CLIENT,
  UPLOAD_CLIENT,
  USER_CLIENT,
  mqttClientOptions,
} from '@app/common';
import { WikiAuthController } from './auth/auth.controller';
import { WikiAuthService } from './auth/auth.service';
import { WikiChatController } from './chat/chat.controller';
import { WikiChatService } from './chat/chat.service';
import { WikiInboxController } from './inbox/inbox.controller';
import { WikiInboxService } from './inbox/inbox.service';
import { PlatformProxy } from './platform-proxy';
import { WikiRagController } from './rag/rag.controller';
import { WikiRagService } from './rag/rag.service';
import { WikiUploadController } from './upload/upload.controller';
import { WikiUploadService } from './upload/upload.service';
import { WikiVisionController } from './vision/vision.controller';
import { WikiVisionService } from './vision/vision.service';

@Module({
  imports: [
    ClientsModule.register([
      { name: UPLOAD_CLIENT, ...mqttClientOptions('wiki-to-upload') },
      { name: AGENTS_CLIENT, ...mqttClientOptions('wiki-to-agents') },
      { name: NOTIFY_CLIENT, ...mqttClientOptions('wiki-to-notify') },
      { name: USER_CLIENT, ...mqttClientOptions('wiki-to-usercenter') },
    ]),
  ],
  controllers: [
    WikiAuthController,
    WikiUploadController,
    WikiChatController,
    WikiRagController,
    WikiVisionController,
    WikiInboxController,
  ],
  providers: [
    PlatformProxy,
    WikiAuthService,
    WikiUploadService,
    WikiChatService,
    WikiRagService,
    WikiVisionService,
    WikiInboxService,
  ],
})
export class FacadeModule {}
