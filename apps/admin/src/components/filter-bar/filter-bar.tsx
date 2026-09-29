'use client';

import { cn } from 'cn';
import { X } from 'lucide-react';
import type * as React from 'react';

import { DateRangeFilter } from '@/components/filter-bar/date-range-filter';
import { FacetedFilter } from '@/components/filter-bar/faceted-filter';
import type {
  DateRangeValue,
  FilterField,
  FilterValue,
  FilterValues,
} from '@/components/filter-bar/types';
import { isFilterActive } from '@/components/filter-bar/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export type FilterBarProps<TData = unknown> = {
  fields: FilterField<TData>[];
  value: FilterValues;
  onChange: (value: FilterValues) => void;
  /** 右侧操作区（如排序、列显示、导出按钮） */
  actions?: React.ReactNode;
  /** 追加在筛选项后的自定义控件 */
  children?: React.ReactNode;
  className?: string;
};

export function FilterBar<TData = unknown>({
  fields,
  value,
  onChange,
  actions,
  children,
  className,
}: FilterBarProps<TData>) {
  const isFiltered = fields.some((field) => isFilterActive(value[field.id]));

  function setField(id: string, next: FilterValue | undefined) {
    const copy = { ...value };
    if (isFilterActive(next)) copy[id] = next;
    else delete copy[id];
    onChange(copy);
  }

  return (
    <div
      role="toolbar"
      aria-orientation="horizontal"
      className={cn('flex w-full items-start justify-between gap-2 p-1', className)}
    >
      <div className="flex flex-1 flex-wrap items-center gap-2">
        {fields.map((field) => {
          const current = value[field.id];
          switch (field.type) {
            case 'text':
              return (
                <Input
                  key={field.id}
                  placeholder={field.placeholder ?? field.label}
                  value={typeof current === 'string' ? current : ''}
                  onChange={(event) => setField(field.id, event.target.value)}
                  className="h-8 w-40 lg:w-56"
                />
              );
            case 'select':
            case 'multiSelect':
              return (
                <FacetedFilter
                  key={field.id}
                  title={field.label}
                  options={field.options}
                  multiple={field.type === 'multiSelect'}
                  value={Array.isArray(current) ? current : []}
                  onChange={(next) => setField(field.id, next)}
                />
              );
            case 'dateRange':
              return (
                <DateRangeFilter
                  key={field.id}
                  title={field.label}
                  value={
                    current && typeof current === 'object' && !Array.isArray(current)
                      ? (current as DateRangeValue)
                      : undefined
                  }
                  onChange={(next) => setField(field.id, next)}
                />
              );
            default:
              return null;
          }
        })}
        {children}
        {isFiltered ? (
          <Button variant="outline" className="border-dashed" onClick={() => onChange({})}>
            <X />
            重置
          </Button>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
