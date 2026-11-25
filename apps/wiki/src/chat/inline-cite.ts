type CiteSource = {
  title?: string;
  sourceName?: string;
  sourceType?: string;
};

type Hit = {
  start: number;
  end: number;
  index: number;
};

/** 把模型写的出处换成 {{cite:序号}}，序号对应 sources。认《标题》、（《标题》，类型）和（出处：标题，类型）。 */
export function markWikiCitations(reply: string, sources: unknown): string {
  if (!reply || !Array.isArray(sources) || sources.length === 0) {
    return reply;
  }
  const hits = collectHits(reply, sources);
  if (!hits.length) {
    return reply;
  }
  let out = '';
  let cursor = 0;
  for (const hit of hits) {
    out += reply.slice(cursor, hit.start);
    out += `{{cite:${hit.index}}}`;
    cursor = hit.end;
  }
  return out + reply.slice(cursor);
}

function collectHits(reply: string, sources: unknown[]): Hit[] {
  const found: Hit[] = [];
  sources.forEach((item, index) => {
    const source = asSource(item);
    if (!source) {
      return;
    }
    const names = namesOf(source);
    const kinds = kindWords(source.sourceType ?? '');
    const kindAlt = kinds.map(escapeRegExp).join('|');
    for (const name of names) {
      const escaped = escapeRegExp(name);
      pushMatches(
        found,
        reply,
        new RegExp(
          `[（(]\\s*《${escaped}》\\s*[，,]\\s*(?:${kindAlt})\\s*[）)]`,
          'gi',
        ),
        index,
      );
      pushMatches(
        found,
        reply,
        new RegExp(
          `[（(]\\s*出处\\s*[：:]\\s*${escaped}\\s*[，,]\\s*(?:${kindAlt})\\s*[）)]`,
          'gi',
        ),
        index,
      );
      pushMatches(
        found,
        reply,
        new RegExp(`出处\\s*[：:]\\s*${escaped}\\s*[，,]\\s*(?:${kindAlt})`, 'gi'),
        index,
      );
      pushMatches(found, reply, new RegExp(`《${escaped}》`, 'g'), index);
    }
  });
  found.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start) || a.index - b.index);
  const chosen: Hit[] = [];
  let cursor = 0;
  for (const hit of found) {
    if (hit.start < cursor) {
      continue;
    }
    chosen.push(hit);
    cursor = hit.end;
  }
  return chosen;
}

function pushMatches(found: Hit[], reply: string, pattern: RegExp, index: number) {
  for (const match of reply.matchAll(pattern)) {
    if (match.index == null) {
      continue;
    }
    found.push({ start: match.index, end: match.index + match[0].length, index });
  }
}

function asSource(item: unknown): CiteSource | null {
  if (!item || typeof item !== 'object') {
    return null;
  }
  const row = item as Record<string, unknown>;
  return {
    title: typeof row.title === 'string' ? row.title : '',
    sourceName: typeof row.sourceName === 'string' ? row.sourceName : '',
    sourceType: typeof row.sourceType === 'string' ? row.sourceType : '',
  };
}

function namesOf(source: CiteSource): string[] {
  const raw = [source.title, source.sourceName, stripExt(source.sourceName)];
  const seen = new Set<string>();
  const names: string[] = [];
  for (const item of raw) {
    const name = (item ?? '').trim();
    if (name.length < 2 || seen.has(name)) {
      continue;
    }
    seen.add(name);
    names.push(name);
  }
  return names.sort((a, b) => b.length - a.length);
}

function stripExt(name: string | undefined): string {
  const text = (name ?? '').trim();
  return text.replace(/\.(docx?|xlsx?|csv|pdf|txt|png|jpe?g|gif|webp)$/i, '');
}

function kindWords(sourceType: string): string[] {
  switch (sourceType) {
    case 'editorjs':
      return ['页面正文', '页面'];
    case 'image':
      return ['图片'];
    case 'doc':
    case 'docx':
      return ['Word'];
    case 'xls':
    case 'xlsx':
    case 'csv':
      return ['Excel'];
    case 'pdf':
      return ['PDF'];
    case 'txt':
      return ['文本'];
    default:
      return ['文件'];
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
