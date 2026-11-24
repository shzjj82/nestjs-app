import { normalizeWebResults } from '../../src/chat/web-search';

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
