const SHANGHAI = 'Asia/Shanghai';
const DAY_MS = 24 * 60 * 60 * 1000;

/** 上海日历日，YYYY-MM-DD。待办只精确到日，比较和凌晨触发都用这一天。 */
export function shanghaiDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SHANGHAI,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${pick('year')}-${pick('month')}-${pick('day')}`;
}

export function shanghaiDayOf(value: Date | null): string | null {
  return value ? shanghaiDate(value) : null;
}

/** 该时刻所属上海日的 00:00。 */
export function shanghaiStart(now: Date): Date {
  return new Date(`${shanghaiDate(now)}T00:00:00+08:00`);
}

/** 距离下一个上海时间 00:00 的毫秒数。正好卡在 00:00 时指向次日。 */
export function msUntilNextShanghaiMidnight(now: Date): number {
  const next = shanghaiStart(now).getTime() + DAY_MS;
  return Math.max(next - now.getTime(), 1000);
}
