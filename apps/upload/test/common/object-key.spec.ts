import { objectKey } from '../../src/common/object-key';

describe('objectKey', () => {
  it('keeps prefix and file extension', () => {
    const key = objectKey('covers', 'hello world.png');
    expect(key).toMatch(/^covers\/\d{4}\/\d{2}\/\d{2}\/[0-9a-f-]+\.png$/);
  });

  it('strips path traversal from prefix', () => {
    const key = objectKey('../etc', 'a.txt');
    expect(key.startsWith('../')).toBe(false);
    expect(key).toContain('etc/');
  });
});
