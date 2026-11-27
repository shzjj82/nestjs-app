export type EditorJsBlock = {
  id?: string;
  type: string;
  data: Record<string, unknown>;
};

export type EditorJsDocument = {
  time?: number;
  version?: string;
  blocks: EditorJsBlock[];
};

export function emptyEditorDocument(): EditorJsDocument {
  return { time: Date.now(), version: '2.30.7', blocks: [] };
}

export function starterArticleDocument(): EditorJsDocument {
  return {
    time: Date.now(),
    version: '2.30.7',
    blocks: [{ type: 'header', data: { text: '', level: 1 } }],
  };
}

export function isEditorJsDocument(value: unknown): value is EditorJsDocument {
  return Boolean(
    value && typeof value === 'object' && Array.isArray((value as EditorJsDocument).blocks),
  );
}

export function normalizeEditorDocument(value: unknown): EditorJsDocument {
  if (isEditorJsDocument(value)) {
    return {
      time: typeof value.time === 'number' ? value.time : Date.now(),
      version: typeof value.version === 'string' ? value.version : '2.30.7',
      blocks: value.blocks,
    };
  }
  if (typeof value === 'string') {
    try {
      return normalizeEditorDocument(JSON.parse(value));
    } catch {
      const trimmed = value.trim();
      return {
        time: Date.now(),
        version: '2.30.7',
        blocks: trimmed ? [{ type: 'paragraph', data: { text: trimmed } }] : [],
      };
    }
  }
  return emptyEditorDocument();
}

export function bodyHasBlocks(body: EditorJsDocument): boolean {
  return (body.blocks?.length ?? 0) > 0;
}
