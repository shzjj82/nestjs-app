'use client';

import { Field, FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function SelectField({
  label,
  value,
  onChange,
  options,
  className,
  triggerClassName,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  className?: string;
  triggerClassName?: string;
}) {
  const select = (
    <Select
      items={options}
      value={value}
      onValueChange={(next) => {
        if (typeof next === 'string') onChange(next);
      }}
    >
      <SelectTrigger className={triggerClassName ?? 'w-full'}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  if (!label) {
    return <div className={className}>{select}</div>;
  }

  return (
    <Field className={className}>
      <FieldLabel>{label}</FieldLabel>
      {select}
    </Field>
  );
}
