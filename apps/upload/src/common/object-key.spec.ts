import { objectKey } from './object-key';

describe('objectKey', () => {
  it('keeps prefix and file extension', () => {
    const key = objectKey('blog/covers', 'hello world.png');
    expect(key).toMatch(/^blog\/covers\/\d{4}\/\d{2}\/\d{2}\/[0-9a-f-]+\.png$/);
  });

  it('strips path traversal from prefix', () => {
    const key = objectKey('../etc', 'a.txt');
    expect(key.startsWith('../')).toBe(false);
    expect(key).toContain('etc/');
  });
});
