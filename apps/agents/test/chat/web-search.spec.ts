import { dropMissingPages, normalizeWebResults, titleSaysMissing } from '../../src/modules/chat/web-search';

describe('normalizeWebResults', () => {
  it('keeps the first five http results and drops the rest', () => {
    const hits = normalizeWebResults([
      { title: 'A', url: 'https://a.example/1', content: '甲' },
      { title: '', url: 'https://a.example/1', content: '重复' },
      { title: '坏', url: 'ftp://a.example/2', content: '丢' },
      { title: 'B', url: 'http://b.example/2', content: '乙' },
      null,
      { title: 'C', url: 'https://c.example/3', content: '丙' },
      { title: 'D', url: 'https://d.example/4', content: '丁' },
      { title: 'E', url: 'https://e.example/5', content: '戊' },
      { title: 'F', url: 'https://f.example/6', content: '己' },
    ]);
    expect(hits.map((item) => item.title)).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(hits[1]?.url).toBe('http://b.example/2');
  });
});

describe('dropMissingPages', () => {
  const hit = (title: string, url: string) => ({ title, url, content: '摘要' });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('drops 404 pages and titles that are already a missing page', async () => {
    expect(titleSaysMissing('404 Not Found')).toBe(true);
    global.fetch = jest.fn(async (url: string) => ({
      status: String(url).includes('gone') ? 404 : 200,
      body: { cancel: async () => undefined },
    })) as unknown as typeof fetch;

    const kept = await dropMissingPages([
      hit('活的', 'https://ok.example/a'),
      hit('死的', 'https://gone.example/b'),
      hit('404 Not Found', 'https://soft.example/c'),
    ]);
    expect(kept.map((item) => item.title)).toEqual(['活的']);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('keeps a page when the check itself fails', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('timeout');
    }) as unknown as typeof fetch;
    const kept = await dropMissingPages([hit('暂时打不开', 'https://slow.example/a')]);
    expect(kept).toHaveLength(1);
  });
});
