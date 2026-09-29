'use client';

import { CalendarIcon, XCircle } from 'lucide-react';
import type * as React from 'react';
import type { DateRange } from 'react-day-picker';

import type { DateRangeValue } from '@/components/filter-bar/types';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';

const dateFormat = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function toDate(timestamp?: number) {
  return timestamp ? new Date(timestamp) : undefined;
}

export function DateRangeFilter({
  title,
  value,
  onChange,
}: {
  title: string;
  value: DateRangeValue | undefined;
  onChange: (value: DateRangeValue | undefined) => void;
}) {
  const range: DateRange = { from: toDate(value?.from), to: toDate(value?.to) };
  const hasValue = Boolean(range.from || range.to);
  const text = [range.from, range.to]
    .filter((d): d is Date => Boolean(d))
    .map((d) => dateFormat.format(d))
    .join(' - ');

  function select(next: DateRange | undefined) {
    const from = next?.from?.getTime();
    const to = next?.to?.getTime();
    onChange(from || to ? { from, to } : undefined);
  }

  function reset(event: React.MouseEvent) {
    event.stopPropagation();
    onChange(undefined);
  }

  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" className="border-dashed font-normal" />}>
        {hasValue ? (
          <div
            role="button"
            aria-label={`清除${title}筛选`}
            tabIndex={0}
            onClick={reset}
            className="rounded-sm opacity-70 transition-opacity hover:opacity-100 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
          >
            <XCircle />
          </div>
        ) : (
          <CalendarIcon />
        )}
        <span className="flex items-center gap-2">
          <span>{title}</span>
          {hasValue ? (
            <>
              <Separator
                orientation="vertical"
                className="mx-0.5 data-vertical:h-4 data-vertical:self-center"
              />
              <span>{text}</span>
            </>
          ) : null}
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar autoFocus captionLayout="dropdown" mode="range" selected={range} onSelect={select} />
      </PopoverContent>
    </Popover>
  );
}
