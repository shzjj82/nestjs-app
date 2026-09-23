import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { fail } from '@app/common';
import type { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    if (!res || typeof res.status !== 'function') {
      throw exception;
    }

    const { code, message } = this.normalize(exception);
    res.status(code).json(fail(code, message));
    void req;
  }

  private normalize(exception: unknown): { code: number; message: string } {
    if (exception instanceof HttpException) {
      const code = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        return { code, message: body };
      }
      if (typeof body === 'object' && body !== null && 'message' in body) {
        const raw = (body as { message: string | string[] }).message;
        return {
          code,
          message: Array.isArray(raw) ? raw.join(', ') : String(raw),
        };
      }
      return { code, message: exception.message };
    }

    if (exception instanceof Error) {
      return { code: HttpStatus.INTERNAL_SERVER_ERROR, message: exception.message };
    }

    return { code: HttpStatus.INTERNAL_SERVER_ERROR, message: '服务器错误' };
  }
}
