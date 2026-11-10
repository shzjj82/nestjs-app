import { msUntilNextShanghaiMidnight, shanghaiDate, shanghaiDayOf } from './shanghai-day';

describe('shanghai day', () => {
  it('treats a date-only UTC midnight as that Shanghai calendar day', () => {
    expect(shanghaiDate(new Date('2026-11-10T00:00:00.000Z'))).toBe('2026-11-10');
    expect(shanghaiDayOf(null)).toBeNull();
  });

  it('rolls the calendar day at Shanghai midnight', () => {
    expect(shanghaiDate(new Date('2026-11-09T15:59:59.000Z'))).toBe('2026-11-09');
    expect(shanghaiDate(new Date('2026-11-09T16:00:00.000Z'))).toBe('2026-11-10');
  });

  it('waits until the next Shanghai midnight', () => {
    expect(msUntilNextShanghaiMidnight(new Date('2026-11-09T16:00:00.000Z'))).toBe(24 * 60 * 60 * 1000);
    expect(msUntilNextShanghaiMidnight(new Date('2026-11-10T15:59:00.000Z'))).toBe(60_000);
  });
});
