import { UsercenterService } from './usercenter.service';

describe('UsercenterService', () => {
  it('returns health', () => {
    const service = new UsercenterService();
    expect(service.health()).toEqual({ status: 'ok' });
  });
});
