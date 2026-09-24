import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { MqttContext } from '@nestjs/microservices';
import { instanceId } from '@app/common';
import { finalize } from 'rxjs/operators';

@Injectable()
export class HandleLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Upload');
  private readonly instance = instanceId('upload');
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
