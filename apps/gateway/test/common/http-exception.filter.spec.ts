import { HttpException, NotFoundException } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { HttpExceptionFilter } from '../../src/common/http-exception.filter';

type Captured = {
  headersSent: boolean;
  statusCode: number;
  body: unknown;
  status: (this: Captured, code: number) => Captured;
  json: (this: Captured, body: unknown) => Captured;
};

function run(exception: unknown) {
  const res: Captured = {
    headersSent: false,
    statusCode: 0,
    body: undefined,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => res,
      getRequest: () => ({}),
    }),
  };
  new HttpExceptionFilter().catch(exception, host as unknown as ArgumentsHost);
  return res;
}

describe('HttpExceptionFilter business codes', () => {
  it('writes string business codes without a numeric code field', () => {
    const res = run(
      new HttpException(
        { code: 'SHARE_UNAVAILABLE', message: '分享链接不可用' },
        404,
      ),
    );
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({
      success: false,
      code: 'SHARE_UNAVAILABLE',
      message: '分享链接不可用',
    });
  });

  it('keeps numeric codes for ordinary http errors', () => {
    const res = run(new NotFoundException('NOT_FOUND'));
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({
      success: false,
      code: 404,
      message: 'NOT_FOUND',
      data: null,
    });
  });
});
