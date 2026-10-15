import { chunkText } from '../../src/rag/chunk';
import {
  editorJsAttachmentKeys,
  editorJsAttachments,
  editorJsToText,
  editorJsUnresolvedAttachments,
  resolvePublicFileUrl,
} from '../../src/rag/editorjs-text';

describe('editorJsToText', () => {
  it('flattens common blocks and strips html', () => {
    const text = editorJsToText(
      {
        blocks: [
          { type: 'header', data: { text: '标题', level: 1 } },
          { type: 'paragraph', data: { text: '一段 <b>加粗</b> 文字' } },
          {
            type: 'list',
            data: { style: 'unordered', items: ['甲', '乙'] },
          },
          {
            type: 'attaches',
            data: {
              title: '报价单.pdf',
              file: { url: 'https://cdn.example/a.pdf' },
            },
          },
        ],
      },
      '文档标题',
      '摘要',
    );
    expect(text).toContain('文档标题');
    expect(text).toContain('摘要');
    expect(text).toContain('标题');
    expect(text).toContain('一段 加粗 文字');
    expect(text).toContain('- 甲');
    expect(text).toContain('【附件：报价单.pdf】');
  });

  it('collects parseable attachments', () => {
    const files = editorJsAttachments({
      blocks: [
        {
          type: 'attaches',
          data: {
            title: '表.xlsx',
            file: { url: 'https://cdn.example/t.xlsx' },
          },
        },
        {
          type: 'image',
          data: { file: { url: 'https://cdn.example/a.png' } },
        },
      ],
    });
    expect(files).toEqual([
      { name: '表.xlsx', url: 'https://cdn.example/t.xlsx', ext: 'xlsx' },
    ]);
  });

  it('supports custom attachment blocks with remote url', () => {
    const files = editorJsAttachments({
      blocks: [
        {
          type: 'attachment',
          data: {
            name: '会议模块PRD.docx',
            url: 'https://cdn.example/wiki/a.docx',
            mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          },
        },
        {
          type: 'attachment',
          data: {
            name: '变更模块.docx',
            fileId: '8c11e6bc-571e-425b-a4a2-e8922ac3844d',
            source: 'local',
            mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          },
        },
      ],
    });
    expect(files).toEqual([
      {
        name: '会议模块PRD.docx',
        url: 'https://cdn.example/wiki/a.docx',
        ext: 'docx',
      },
    ]);
    expect(editorJsUnresolvedAttachments({
      blocks: [
        {
          type: 'attachment',
          data: {
            name: '变更模块.docx',
            fileId: '8c11e6bc-571e-425b-a4a2-e8922ac3844d',
            source: 'local',
          },
        },
      ],
    })).toEqual(['变更模块.docx']);
  });

  it('collects attachment keys for delete-by-source', () => {
    const prev = process.env.OSS_PUBLIC_BASE;
    process.env.OSS_PUBLIC_BASE = 'https://cdn.example';
    try {
      const keys = editorJsAttachmentKeys({
        blocks: [
          {
            type: 'attachment',
            data: {
              name: 'a.docx',
              url: 'https://cdn.example/a.docx',
            },
          },
          {
            type: 'attachment',
            data: {
              name: 'b.docx',
              fileId: 'wiki/wiki/attachments/b.docx',
            },
          },
        ],
      });
      expect(keys).toContain('https://cdn.example/a.docx');
      expect(keys).toContain('wiki/wiki/attachments/b.docx');
      expect(keys).toContain('https://cdn.example/wiki/wiki/attachments/b.docx');
    } finally {
      if (prev === undefined) {
        delete process.env.OSS_PUBLIC_BASE;
      } else {
        process.env.OSS_PUBLIC_BASE = prev;
      }
    }
  });

  it('resolves oss object key via public base', () => {
    const prev = process.env.OSS_PUBLIC_BASE;
    process.env.OSS_PUBLIC_BASE = 'https://cdn.example';
    try {
      expect(resolvePublicFileUrl('wiki/wiki/attachments/a.docx')).toBe(
        'https://cdn.example/wiki/wiki/attachments/a.docx',
      );
      expect(resolvePublicFileUrl('https://cdn.example/x.pdf')).toBe(
        'https://cdn.example/x.pdf',
      );
      expect(resolvePublicFileUrl('8c11e6bc-571e-425b-a4a2-e8922ac3844d')).toBe('');
    } finally {
      if (prev === undefined) {
        delete process.env.OSS_PUBLIC_BASE;
      } else {
        process.env.OSS_PUBLIC_BASE = prev;
      }
    }
  });
});

describe('chunkText', () => {
  it('returns single chunk for short text', () => {
    expect(chunkText('hello')).toEqual(['hello']);
  });

  it('splits long text with overlap', () => {
    const text = '甲'.repeat(120) + '\n\n' + '乙'.repeat(120) + '\n\n' + '丙'.repeat(120);
    const chunks = chunkText(text, { size: 100, overlap: 20 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join('')).toContain('甲');
    expect(chunks.join('')).toContain('丙');
  });
});
