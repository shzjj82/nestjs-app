import { newBindScene } from './store-scene';

describe('store-scene', () => {
  it('fits wechat unlimited qr scene length', () => {
    const scene = newBindScene();
    expect(scene).toMatch(/^[0-9a-f]{24}$/);
    expect(scene.length).toBeLessThanOrEqual(32);
  });
});
