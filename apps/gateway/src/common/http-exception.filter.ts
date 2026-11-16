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
    if (res.headersSent) {
      return;
    }

    const normalized = this.normalize(exception);
    if (typeof normalized.code === 'string') {
      res.status(normalized.status).json({
        success: false,
        code: normalized.code,
        message: normalized.message,
      });
      return;
    }
    res
      .status(normalized.status)
      .json(fail(normalized.code, normalized.message));
    void req;
  }

  private normalize(exception: unknown): {
    status: number;
    code: number | string;
    message: string;
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message = this.messageOf(body, exception.message);
      if (typeof body === 'object' && body !== null) {
        const businessCode = (body as { code?: unknown }).code;
        if (typeof businessCode === 'string' && businessCode) {
          return { status, code: businessCode, message };
        }
      }
      return { status, code: status, message };
    }

    if (exception instanceof Error) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        code: HttpStatus.INTERNAL_SERVER_ERROR,
        message: exception.message,
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: HttpStatus.INTERNAL_SERVER_ERROR,
      message: '服务器错误',
    };
  }

  private messageOf(body: unknown, fallback: string): string {
    if (typeof body === 'string') {
      return body;
    }
    if (typeof body === 'object' && body !== null && 'message' in body) {
      const text = textOf(body.message);
      if (text) {
        return text;
      }
    }
    return fallback;
  }
}

function textOf(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => textOf(item))
      .filter(Boolean)
      .join(', ');
  }
  return '';
}
