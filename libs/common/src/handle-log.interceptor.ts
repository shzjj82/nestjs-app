import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
  type Type,
} from '@nestjs/common';
import { MqttContext } from '@nestjs/microservices';
import { finalize } from 'rxjs/operators';
import { instanceId } from './mqtt';

export function createHandleLogInterceptor(
  loggerContext: string,
  service: string,
): Type<NestInterceptor> {
  @Injectable()
  class HandleLogInterceptor implements NestInterceptor {
    private readonly logger = new Logger(loggerContext);
    private readonly instance = instanceId(service);
    private inflight = 0;

    intercept(context: ExecutionContext, next: CallHandler) {
      const topic = this.topic(context);
      const handleId = `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 6)}`;
      this.inflight += 1;
      this.logger.log(
        `[${this.instance}] START ${topic} handle=${handleId} inflight=${this.inflight}`,
      );
      return next.handle().pipe(
        finalize(() => {
          this.inflight -= 1;
          this.logger.log(
            `[${this.instance}] DONE  ${topic} handle=${handleId} inflight=${this.inflight}`,
          );
        }),
      );
    }

    private topic(context: ExecutionContext): string {
      const mqtt = context.switchToRpc().getContext<MqttContext>();
      return mqtt.getTopic();
    }
  }

  return HandleLogInterceptor;
}

export const DocsHandleLogInterceptor = createHandleLogInterceptor('Docs', 'docs');
export const UploadHandleLogInterceptor = createHandleLogInterceptor('Upload', 'upload');
export const UsercenterHandleLogInterceptor = createHandleLogInterceptor(
  'Usercenter',
  'usercenter',
);
