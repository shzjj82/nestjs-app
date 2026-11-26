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

/** 把模型写的出处换成 {{cite:序号}}。来源二字和括号由前端按界面语言补上。 */
export function markWikiCitations(reply: string, sources: unknown): string {
  if (!reply || !Array.isArray(sources) || sources.length === 0) {
    return reply;
  }
  const hits = mergeSameSource(
    reply,
    collectHits(reply, sources).map((hit) => expandLocationLead(reply, hit)),
  );
  if (!hits.length) {
    return reply;
  }
  let out = '';
  let cursor = 0;
  for (const hit of hits) {
    const span = expandSourcePrefix(reply, hit);
    if (span.start < cursor) {
      continue;
    }
    out += reply.slice(cursor, span.start);
    out += `{{cite:${hit.index}}}`;
    cursor = span.end;
  }
  return out + reply.slice(cursor);
}

const CITE_GLUE =
  /^(?:[\s（(）)，,、：:;；]|类型|定位|来源|页面正文|页面|图片|待办|Word|Excel|PDF|文本|文件|Source)*$/i;

function expandSourcePrefix(reply: string, hit: Hit): Hit {
  const before = reply.slice(0, hit.start);
  const lead = before.match(/(?:[（(]\s*)?(?:来源|Source)\s*[：:]\s*$/i);
  if (!lead) {
    return hit;
  }
  const start = hit.start - lead[0].length;
  const tail = reply.slice(hit.end).match(/^\s*[）)]/);
  return { ...hit, start, end: hit.end + (tail ? tail[0].length : 0) };
}

function expandLocationLead(reply: string, hit: Hit): Hit {
  const lead = reply.slice(0, hit.start).match(
    /(?:[（(]\s*)?类型\s*[：:]\s*(?:页面正文|页面|图片|待办|Word|Excel|PDF|文本|文件)\s*[，,]\s*定位\s*[：:]\s*$/,
  );
  if (!lead) {
    return hit;
  }
  return { ...hit, start: hit.start - lead[0].length };
}

/** 标题和「类型 / 定位」紧挨着写同一篇时，收成一个出处。两句话里各写一次仍各留一个。 */
function mergeSameSource(reply: string, hits: Hit[]): Hit[] {
  const ordered = [...hits].sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: Hit[] = [];
  for (const hit of ordered) {
    const prev = merged[merged.length - 1];
    const gap = prev && hit.start > prev.end ? reply.slice(prev.end, hit.start) : '';
    if (prev && prev.index === hit.index && (hit.start <= prev.end || isCiteGlue(gap))) {
      prev.start = Math.min(prev.start, hit.start);
      prev.end = Math.max(prev.end, hit.end);
      continue;
    }
    merged.push({ ...hit });
  }
  return merged.map((hit) => closeExtraParens(reply, hit));
}

function isCiteGlue(text: string): boolean {
  return text.length <= 80 && CITE_GLUE.test(text);
}

function closeExtraParens(reply: string, hit: Hit): Hit {
  let depth = 0;
  for (const ch of reply.slice(hit.start, hit.end)) {
    if (ch === '（' || ch === '(') {
      depth += 1;
    } else if ((ch === '）' || ch === ')') && depth > 0) {
      depth -= 1;
    }
  }
  let end = hit.end;
  while (depth > 0) {
    const tail = reply.slice(end).match(/^\s*[）)]/);
    if (!tail) {
      break;
    }
    end += tail[0].length;
    depth -= 1;
  }
  return end === hit.end ? hit : { ...hit, end };
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
      const quotedName = `(?:《${escaped}》|${escaped})`;
      pushMatches(
        found,
        reply,
        new RegExp(
          `(?:[（(]\\s*)?出处\\s*[：:]\\s*(?:${kindAlt})\\s*[「『"“]\\s*${quotedName}\\s*[」』"”]\\s*[）)]?`,
          'gi',
        ),
        index,
      );
      pushMatches(
        found,
        reply,
        new RegExp(`(?:${kindAlt})\\s*[「『"“]\\s*${quotedName}\\s*[」』"”]`, 'gi'),
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
    case 'todo':
      return ['待办'];
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
