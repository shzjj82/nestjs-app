import { UsercenterService } from './usercenter.service';

describe('UsercenterService', () => {
  it('returns health', () => {
    const service = new UsercenterService();
    const health = service.health();
    expect(health.status).toBe('up');
    expect(health.service).toBe('usercenter');
    expect(health.version).toBeTruthy();
    expect(health.instance).toBeTruthy();
  });
});
