import { editorJsImages } from '../../src/rag/text/editorjs-text';
import { textFromOcrMessage } from '../../src/ocr/ocr-client';

describe('editorJsImages', () => {
  it('collects image blocks and image attachments once', () => {
    const urls = editorJsImages({
      blocks: [
        { type: 'image', data: { file: { url: 'https://cdn.example/a.png' } } },
        { type: 'image', data: { file: { url: 'https://cdn.example/a.png' } } },
        {
          type: 'attaches',
          data: { file: { url: 'https://cdn.example/sheet.xlsx', name: 'sheet.xlsx' } },
        },
        {
          type: 'attaches',
          data: { file: { url: 'https://cdn.example/shot.jpg', name: 'shot.jpg' } },
        },
      ],
    });
    expect(urls).toEqual(['https://cdn.example/a.png', 'https://cdn.example/shot.jpg']);
  });
});

describe('textFromOcrMessage', () => {
  it('reads string and array content', () => {
    expect(textFromOcrMessage('  你好 ')).toBe('你好');
    expect(textFromOcrMessage([{ text: '甲' }, { text: '乙' }])).toBe('甲乙');
    expect(textFromOcrMessage(null)).toBe('');
  });
});
