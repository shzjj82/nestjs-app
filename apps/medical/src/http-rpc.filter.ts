import { Catch, HttpException } from '@nestjs/common';
import { BaseRpcExceptionFilter, RpcException } from '@nestjs/microservices';
import type { ArgumentsHost } from '@nestjs/common';

/** 把 TCM 服务里原有的 HttpException 转成网关能识别的 { status, message }。 */
@Catch(HttpException)
export class HttpRpcFilter extends BaseRpcExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const raw = exception.getResponse();
    const message =
      typeof raw === 'string'
        ? raw
        : typeof raw === 'object' && raw && 'message' in raw
          ? Array.isArray((raw as { message: unknown }).message)
            ? String((raw as { message: unknown[] }).message[0])
            : String((raw as { message: unknown }).message)
          : exception.message;
    return super.catch(
      new RpcException({ status: exception.getStatus(), message }),
      host,
    );
  }
}
