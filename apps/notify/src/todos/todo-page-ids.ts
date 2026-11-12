const PAGE_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function asPageIds(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : raw !== undefined && raw !== null ? [raw] : [];
  return [
    ...new Set(
      list
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((item) => PAGE_ID.test(item)),
    ),
  ];
}
