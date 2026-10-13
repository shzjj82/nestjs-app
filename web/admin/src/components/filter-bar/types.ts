import type * as React from 'react';

export type FilterOption = {
  label: string;
  value: string;
  count?: number;
  icon?: React.ComponentType<React.ComponentProps<'svg'>>;
};

/** 时间戳（毫秒） */
export type DateRangeValue = { from?: number; to?: number };

export type FilterValue = string | string[] | DateRangeValue;

export type FilterValues = Record<string, FilterValue | undefined>;

type FilterFieldBase<TData> = {
  /** 同时作为 URL / API 查询参数名 */
  id: string;
  label: string;
  /** 客户端过滤取值；缺省读取 row[id] */
  accessor?: (row: TData) => unknown;
};

export type FilterField<TData = unknown> =
  | (FilterFieldBase<TData> & { type: 'text'; placeholder?: string })
  | (FilterFieldBase<TData> & { type: 'select' | 'multiSelect'; options: FilterOption[] })
  | (FilterFieldBase<TData> & { type: 'dateRange' });
