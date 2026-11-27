import { pageProbeTimeoutMs, searxngUrl, webSearchTimeoutMs } from '../ai/ai-env';
import type { WebHit } from './chat-messages';

const WEB_RESULT_LIMIT = 5;
const WEB_CANDIDATE_LIMIT = 12;

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
    signal: AbortSignal.timeout(webSearchTimeoutMs()),
  });
  if (!res.ok) {
    throw new Error(`SEARXNG_${res.status}`);
  }
  const payload = (await res.json()) as { results?: unknown };
  const candidates = normalizeWebResults(payload.results, WEB_CANDIDATE_LIMIT);
  const alive = await dropMissingPages(candidates);
  return alive.slice(0, WEB_RESULT_LIMIT);
}

/** 标题本身就是 404 页，或打开后返回 404 / 410。打不开时保留，避免网络抖动把结果清空。 */
export async function dropMissingPages(hits: WebHit[]): Promise<WebHit[]> {
  const checked = await Promise.all(
    hits.map(async (hit) => ({ hit, missing: await pageIsMissing(hit) })),
  );
  return checked.filter((item) => !item.missing).map((item) => item.hit);
}

export function titleSaysMissing(title: string): boolean {
  const text = title.trim();
  if (!text) {
    return false;
  }
  return /^(?:404|410)(?:\s+not\s+found)?$/i.test(text)
    || /^(?:page\s+not\s+found|not\s+found)$/i.test(text)
    || /^(?:页面不存在|页面未找到|找不到页面|内容不存在)$/.test(text)
    || /\b404\s+not\s+found\b/i.test(text);
}

async function pageIsMissing(hit: WebHit): Promise<boolean> {
  if (titleSaysMissing(hit.title)) {
    return true;
  }
  const status = await httpStatus(hit.url);
  return status === 404 || status === 410;
}

async function httpStatus(url: string): Promise<number | null> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(pageProbeTimeoutMs()),
      headers: {
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (compatible; WikiLinkCheck/1.0)',
      },
    });
    await res.body?.cancel().catch(() => undefined);
    return typeof res.status === 'number' ? res.status : null;
  } catch {
    return null;
  }
}

export function normalizeWebResults(raw: unknown, limit = WEB_RESULT_LIMIT): WebHit[] {
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
    if (hits.length >= limit) {
      break;
    }
  }
  return hits;
}
