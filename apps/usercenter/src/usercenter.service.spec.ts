import { UsercenterService } from './usercenter.service';

describe('UsercenterService', () => {
  it('returns seeded users', () => {
    const service = new UsercenterService();
    const result = service.findAll();
    expect(result.map((user) => user.id)).toEqual(['u-1', 'u-2']);}
  });
});
