import type {
  DateRangeValue,
  FilterField,
  FilterValue,
  FilterValues,
} from '@/components/filter-bar/types';

const DAY_MS = 24 * 60 * 60 * 1000;

function isDateRange(value: unknown): value is DateRangeValue {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isFilterActive(value: FilterValue | undefined): value is FilterValue {
  if (value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(value.from || value.to);
}

/**
 * 转成接口查询参数：文本 `id=v`，多选 `id=a&id=b`，日期 `idFrom` / `idTo`（ISO 字符串，结束日含当天）
 */
export function filtersToSearchParams(
  values: FilterValues,
  params: URLSearchParams = new URLSearchParams(),
): URLSearchParams {
  for (const [id, value] of Object.entries(values)) {
    if (!isFilterActive(value)) continue;
    if (typeof value === 'string') params.set(id, value.trim());
    else if (Array.isArray(value)) value.forEach((v) => params.append(id, v));
    else {
      if (value.from) params.set(`${id}From`, new Date(value.from).toISOString());
      if (value.to) params.set(`${id}To`, new Date(value.to + DAY_MS - 1).toISOString());
    }
  }
  return params;
}

function readValue<TData>(row: TData, field: FilterField<TData>): unknown {
  if (field.accessor) return field.accessor(row);
  return (row as Record<string, unknown>)[field.id];
}

function toTimestamp(value: unknown): number | undefined {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? undefined : time;
  }
  return undefined;
}

export function matchesFilters<TData>(
  row: TData,
  fields: FilterField<TData>[],
  values: FilterValues,
): boolean {
  return fields.every((field) => {
    const filter = values[field.id];
    if (!isFilterActive(filter)) return true;
    const cell = readValue(row, field);

    if (typeof filter === 'string') {
      return String(cell ?? '').toLowerCase().includes(filter.trim().toLowerCase());
    }
    if (Array.isArray(filter)) {
      const cellValues = (Array.isArray(cell) ? cell : [cell]).map(String);
      return cellValues.some((v) => filter.includes(v));
    }
    if (isDateRange(filter)) {
      const time = toTimestamp(cell);
      if (time === undefined) return false;
      if (filter.from && time < filter.from) return false;
      if (filter.to && time >= filter.to + DAY_MS) return false;
      return true;
    }
    return true;
  });
}

export function filterRows<TData>(
  rows: TData[],
  fields: FilterField<TData>[],
  values: FilterValues,
): TData[] {
  if (!fields.some((field) => isFilterActive(values[field.id]))) return rows;
  return rows.filter((row) => matchesFilters(row, fields, values));
}
