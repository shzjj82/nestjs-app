'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { groupPermissions, type Permission } from '@/lib/businesses';

export function PermissionChecklist({
  idPrefix,
  permissions,
  value,
  onChange,
  emptyMessage = '暂无可选功能点',
}: {
  idPrefix: string;
  permissions: Permission[];
  value: string[];
  onChange: (next: string[]) => void;
  emptyMessage?: string;
}) {
  if (!permissions.length) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }
  return (
    <div className="space-y-4">
      {groupPermissions(permissions).map(([module, items]) => (
        <div key={module} className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground">{module}</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {items.map((item) => {
              const id = `${idPrefix}-${item.id}`;
              return (
                <div key={item.id} className="flex items-center gap-2 rounded-md border p-2.5">
                  <Checkbox
                    id={id}
                    checked={value.includes(item.id)}
                    onCheckedChange={(checked) =>
                      onChange(
                        checked ? [...value, item.id] : value.filter((v) => v !== item.id),
                      )
                    }
                  />
                  <Label htmlFor={id} className="font-normal">
                    {item.name}
                    <span className="font-mono text-xs text-muted-foreground">{item.code}</span>
                  </Label>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
