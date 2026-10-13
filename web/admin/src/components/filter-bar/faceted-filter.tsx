'use client';

import { cn } from 'cn';
import { Check, PlusCircle, XCircle } from 'lucide-react';
import * as React from 'react';

import type { FilterOption } from '@/components/filter-bar/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';

export function FacetedFilter({
  title,
  options,
  multiple = true,
  value,
  onChange,
}: {
  title: string;
  options: FilterOption[];
  multiple?: boolean;
  value: string[];
  onChange: (value: string[] | undefined) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = new Set(value);

  function toggle(option: FilterOption) {
    const isSelected = selected.has(option.value);
    if (!multiple) {
      onChange(isSelected ? undefined : [option.value]);
      setOpen(false);
      return;
    }
    const next = new Set(selected);
    if (isSelected) next.delete(option.value);
    else next.add(option.value);
    onChange(next.size ? Array.from(next) : undefined);
  }

  function reset(event?: React.MouseEvent) {
    event?.stopPropagation();
    onChange(undefined);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="outline" className="border-dashed font-normal" />}>
        {selected.size > 0 ? (
          <div
            role="button"
            aria-label={`清除${title}筛选`}
            tabIndex={0}
            className="rounded-sm opacity-70 transition-opacity hover:opacity-100 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
            onClick={reset}
          >
            <XCircle />
          </div>
        ) : (
          <PlusCircle />
        )}
        {title}
        {selected.size > 0 ? (
          <>
            <Separator orientation="vertical" className="mx-0.5 data-vertical:h-4 data-vertical:self-center" />
            <Badge variant="secondary" className="rounded-sm px-1 font-normal lg:hidden">
              {selected.size}
            </Badge>
            <div className="hidden items-center gap-1 lg:flex">
              {selected.size > 2 ? (
                <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                  已选 {selected.size} 项
                </Badge>
              ) : (
                options
                  .filter((option) => selected.has(option.value))
                  .map((option) => (
                    <Badge
                      key={option.value}
                      variant="secondary"
                      className="rounded-sm px-1 font-normal"
                    >
                      {option.label}
                    </Badge>
                  ))
              )}
            </div>
          </>
        ) : null}
      </PopoverTrigger>
      <PopoverContent className="w-52 p-0" align="start">
        <Command>
          <CommandInput placeholder={title} />
          <CommandList className="max-h-full">
            <CommandEmpty>无匹配项</CommandEmpty>
            <CommandGroup className="max-h-75 scroll-py-1 overflow-x-hidden overflow-y-auto">
              {options.map((option) => {
                const isSelected = selected.has(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    className="[&>svg:last-child]:hidden"
                    onSelect={() => toggle(option)}
                  >
                    <div
                      className={cn(
                        'flex size-4 items-center justify-center rounded-sm border border-primary',
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'opacity-50 [&_svg]:invisible',
                      )}
                    >
                      <Check />
                    </div>
                    {option.icon ? <option.icon /> : null}
                    <span className="truncate">{option.label}</span>
                    {option.count !== undefined ? (
                      <span className="ml-auto font-mono text-xs">{option.count}</span>
                    ) : null}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {selected.size > 0 ? (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem onSelect={() => reset()} className="justify-center text-center">
                    清除筛选
                  </CommandItem>
                </CommandGroup>
              </>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
