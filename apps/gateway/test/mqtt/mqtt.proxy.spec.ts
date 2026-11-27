import { HttpException, NotFoundException } from '@nestjs/common';
import { throwError } from 'rxjs';
import { MqttProxy } from '../../src/modules/mqtt/mqtt.proxy';

describe('MqttProxy business codes', () => {
  const proxy = new MqttProxy();

  function client(error: unknown) {
    return {
      send: () => throwError(() => error),
    };
  }

  it('passes a string business code through on share failures', async () => {
    await expect(
      proxy.send(
        client({
          status: 404,
          message: '分享链接不可用',
          code: 'SHARE_UNAVAILABLE',
        }) as never,
        'wiki.share.view',
      ),
    ).rejects.toBeInstanceOf(HttpException);

    try {
      await proxy.send(
        client({
          error: {
            status: 403,
            message: '不允许再分享',
            code: 'SHARE_RESHARE_DENIED',
          },
        }) as never,
        'wiki.share.reshare',
      );
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(403);
      expect((err as HttpException).getResponse()).toEqual({
        code: 'SHARE_RESHARE_DENIED',
        message: '不允许再分享',
      });
    }
  });

  it('keeps status-only errors as ordinary http exceptions', async () => {
    await expect(
      proxy.send(
        client({ status: 404, message: 'NOT_FOUND' }) as never,
        'wiki.post.findId',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
