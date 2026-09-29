'use client';

import type { LucideIcon } from 'lucide-react';
import { Ellipsis } from 'lucide-react';
import { Fragment } from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type DataTableRowAction = {
  label: string;
  onSelect: () => void;
  icon?: LucideIcon;
  variant?: 'default' | 'destructive';
  separatorBefore?: boolean;
};

export function DataTableRowActions({ actions }: { actions: DataTableRowAction[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label="打开菜单"
            variant="ghost"
            size="icon-sm"
            className="data-popup-open:bg-muted"
          />
        }
      >
        <Ellipsis />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {actions.map(({ label, onSelect, icon: Icon, variant, separatorBefore }) => (
          <Fragment key={label}>
            {separatorBefore ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem variant={variant} onClick={onSelect}>
              {Icon ? <Icon /> : null}
              {label}
            </DropdownMenuItem>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
