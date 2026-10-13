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

  const groups = groupPermissions(permissions);

  return (
    <div className="space-y-4">
      {groups.map(([module, items]) => {
        const ids = items.map((item) => item.id);
        const selectedCount = ids.filter((id) => value.includes(id)).length;
        const allChecked = selectedCount === ids.length;
        const someChecked = selectedCount > 0 && !allChecked;

        return (
          <section key={module} className="overflow-hidden rounded-xl border">
            <div className="flex items-center justify-between gap-3 border-b bg-muted/40 px-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <Checkbox
                  aria-label={`全选 ${module}`}
                  checked={allChecked}
                  indeterminate={someChecked}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      onChange([...new Set([...value, ...ids])]);
                    } else {
                      onChange(value.filter((id) => !ids.includes(id)));
                    }
                  }}
                />
                <div className="min-w-0">
                  <div className="text-sm font-medium">{module}</div>
                  <div className="text-xs text-muted-foreground">
                    已选 {selectedCount}/{items.length}
                  </div>
                </div>
              </div>
            </div>
            <div className="grid gap-2 p-3 sm:grid-cols-2">
              {items.map((item) => {
                const id = `${idPrefix}-${item.id}`;
                return (
                  <div key={item.id} className="flex items-start gap-2 rounded-md border p-2.5">
                    <Checkbox
                      id={id}
                      className="mt-0.5"
                      checked={value.includes(item.id)}
                      onCheckedChange={(checked) =>
                        onChange(
                          checked ? [...value, item.id] : value.filter((v) => v !== item.id),
                        )
                      }
                    />
                    <Label htmlFor={id} className="min-w-0 flex-1 space-y-0.5 font-normal">
                      <span className="block text-sm">{item.name}</span>
                      <span className="block font-mono text-xs text-muted-foreground">
                        {item.code}
                      </span>
                      {item.description ? (
                        <span className="block text-xs text-muted-foreground">
                          {item.description}
                        </span>
                      ) : null}
                    </Label>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
