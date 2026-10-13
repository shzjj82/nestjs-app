import { CircleCheck, CircleX } from 'lucide-react';

import { Badge } from '@/components/ui/badge';

export function StatusBadge({
  active,
  activeLabel = '正常',
  inactiveLabel = '停用',
}: {
  active: boolean;
  activeLabel?: string;
  inactiveLabel?: string;
}) {
  const Icon = active ? CircleCheck : CircleX;
  return (
    <Badge variant="outline" className="py-1 [&>svg]:size-3.5">
      <Icon />
      <span className="capitalize">{active ? activeLabel : inactiveLabel}</span>
    </Badge>
  );
}
