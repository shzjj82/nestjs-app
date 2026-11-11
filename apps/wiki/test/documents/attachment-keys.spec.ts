import {
  editorJsAttachmentKeys,
  removedAttachmentKeys,
} from '../../src/documents/attachment-keys';

describe('attachment-keys', () => {
  it('collects url / fileId / key from attachment blocks', () => {
    expect(
      editorJsAttachmentKeys({
        blocks: [
          {
            type: 'attachment',
            data: {
              name: 'a.docx',
              url: 'https://cdn.example/a.docx',
            },
          },
          {
            type: 'attaches',
            data: {
              title: 'b.pdf',
              file: { url: 'https://cdn.example/b.pdf', key: 'wiki/b.pdf' },
            },
          },
          {
            type: 'paragraph',
            data: { text: 'ignore' },
          },
        ],
      }).sort(),
    ).toEqual(
      ['https://cdn.example/a.docx', 'https://cdn.example/b.pdf', 'wiki/b.pdf'].sort(),
    );
  });

  it('diffs removed attachments on update', () => {
    const before = {
      blocks: [
        {
          type: 'attachment',
          data: { name: 'keep.docx', url: 'https://cdn.example/keep.docx' },
        },
        {
          type: 'attachment',
          data: { name: 'gone.docx', url: 'https://cdn.example/gone.docx' },
        },
      ],
    };
    const after = {
      blocks: [
        {
          type: 'attachment',
          data: { name: 'keep.docx', url: 'https://cdn.example/keep.docx' },
        },
      ],
    };
    expect(removedAttachmentKeys(before, after)).toEqual([
      'https://cdn.example/gone.docx',
    ]);
  });
});
