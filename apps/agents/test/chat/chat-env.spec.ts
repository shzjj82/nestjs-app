import { pageProbeTimeoutMs, webSearchTimeoutMs } from '../../src/ai/ai-env';

describe('web search timeouts', () => {
  const originalSearch = process.env.WEB_SEARCH_TIMEOUT_MS;
  const originalProbe = process.env.PAGE_PROBE_TIMEOUT_MS;

  afterEach(() => {
    restore('WEB_SEARCH_TIMEOUT_MS', originalSearch);
    restore('PAGE_PROBE_TIMEOUT_MS', originalProbe);
  });

  it('uses 8s and 2.5s when the environment is empty', () => {
    delete process.env.WEB_SEARCH_TIMEOUT_MS;
    delete process.env.PAGE_PROBE_TIMEOUT_MS;
    expect(webSearchTimeoutMs()).toBe(8_000);
    expect(pageProbeTimeoutMs()).toBe(2_500);
  });

  it('reads positive overrides and ignores invalid values', () => {
    process.env.WEB_SEARCH_TIMEOUT_MS = '3000';
    process.env.PAGE_PROBE_TIMEOUT_MS = '0';
    expect(webSearchTimeoutMs()).toBe(3_000);
    expect(pageProbeTimeoutMs()).toBe(2_500);
  });
});

function restore(name: string, value: string | undefined) {
  if (value == null) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}
