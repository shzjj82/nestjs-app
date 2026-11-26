/** 按原顺序并发执行，同时进行的数量不超过 limit。 */
export async function mapPool<T, R>(
  items: readonly T[],
  limit: number,
  run: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!items.length) {
    return [];
  }
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Math.min(Math.max(1, limit), items.length);
  await Promise.all(
    Array.from({ length: workers }, async () => {
      while (next < items.length) {
        const index = next;
        next += 1;
        out[index] = await run(items[index]!, index);
      }
    }),
  );
  return out;
}
