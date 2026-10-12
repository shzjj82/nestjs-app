import {
  imageExtForMime,
  qrImageFilename,
  sniffImageMime,
} from '../src/image';

describe('image helpers', () => {
  it('sniffs jpeg / png from base64 magic', () => {
    expect(sniffImageMime('/9j/xxxx', 'image/png')).toBe('image/jpeg');
    expect(sniffImageMime('iVBORxxxx', 'image/jpeg')).toBe('image/png');
    expect(sniffImageMime('xxxx', 'image/png')).toBe('image/png');
  });

  it('builds qr filenames from mime', () => {
    expect(imageExtForMime('image/jpeg')).toBe('.jpg');
    expect(qrImageFilename('login-qr-abc', 'image/jpeg', 'x.png')).toBe(
      'login-qr-abc.jpg',
    );
    expect(qrImageFilename('store-bind-1', 'application/octet-stream', 'x.png')).toBe(
      'x.png',
    );
  });
});
