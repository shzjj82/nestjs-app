import JSZip from 'jszip';
import { embeddedImages } from '../../src/modules/rag/text/embedded-images';

describe('embeddedImages', () => {
  it('reads images stored inside a docx zip', async () => {
    const zip = new JSZip();
    zip.file('word/media/shot.png', Buffer.alloc(300, 7));
    zip.file('word/document.xml', '<w:document/>');
    const buf = await zip.generateAsync({ type: 'nodebuffer' });
    const images = await embeddedImages(buf, 'docx');
    expect(images.map((item) => item.name)).toEqual(['shot.png']);
    expect(images[0]?.mime).toBe('image/png');
    expect(images[0]?.bytes.length).toBe(300);
  });

  it('pulls a jpeg embedded in a pdf', () => {
    const jpeg = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff]),
      Buffer.alloc(300, 1),
      Buffer.from([0xff, 0xd9]),
    ]);
    const pdf = Buffer.concat([Buffer.from('%PDF-1.4 '), jpeg, Buffer.from(' trailer')]);
    return embeddedImages(pdf, 'pdf').then((images) => {
      expect(images).toHaveLength(1);
      expect(images[0]?.mime).toBe('image/jpeg');
      expect(images[0]?.bytes.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
    });
  });
});
