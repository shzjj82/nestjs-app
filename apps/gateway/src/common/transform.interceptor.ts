import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { ok, unwrapData } from '@app/common';
import type { Response } from 'express';
import { map } from 'rxjs/operators';

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const http = context.switchToHttp();
    const res = http.getResponse<Response>();

    return next.handle().pipe(
      map((payload: unknown) => {
        if (res.headersSent) {
          return payload;
        }
        if (this.alreadyWrapped(payload)) {
          return payload;
        }
        const code = res.statusCode || 200;
        return ok(unwrapData(payload), 'ok', code);
      }),
    );
  }

  private alreadyWrapped(payload: unknown): boolean {
    return (
      !!payload &&
      typeof payload === 'object' &&
      'success' in payload &&
      'code' in payload &&
      'message' in payload &&
      'data' in payload
    );
  }
}
