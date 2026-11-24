import { searxngUrl } from './chat-env';
import type { WebHit } from './chat-messages';

const WEB_SEARCH_TIMEOUT_MS = 8_000;
const WEB_RESULT_LIMIT = 5;

/** 向本机 SearXNG 取网页摘要。未配置或失败时由调用方决定是否放弃联网。 */
export async function searchWeb(query: string): Promise<WebHit[]> {
  const base = searxngUrl();
  const q = query.trim().slice(0, 400);
  if (!base || !q) {
    return [];
  }
  const endpoint = new URL('search', `${base}/`);
  endpoint.searchParams.set('q', q);
  endpoint.searchParams.set('format', 'json');
  endpoint.searchParams.set('language', 'zh-CN');
  endpoint.searchParams.set('categories', 'general');
  const res = await fetch(endpoint, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(WEB_SEARCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`SEARXNG_${res.status}`);
  }
  const payload = (await res.json()) as { results?: unknown };
  return normalizeWebResults(payload.results);
}

export function normalizeWebResults(raw: unknown): WebHit[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const seen = new Set<string>();
  const hits: WebHit[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const rec = item as Record<string, unknown>;
    const url = typeof rec.url === 'string' ? rec.url.trim() : '';
    const title = typeof rec.title === 'string' ? rec.title.trim() : '';
    const content = typeof rec.content === 'string' ? rec.content.trim() : '';
    if (!/^https?:\/\//i.test(url) || seen.has(url)) {
      continue;
    }
    seen.add(url);
    hits.push({
      title: (title || url).slice(0, 200),
      url,
      content: content.slice(0, 500),
    });
    if (hits.length >= WEB_RESULT_LIMIT) {
      break;
    }
  }
  return hits;
}
