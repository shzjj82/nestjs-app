'use client';

import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  emptyTemplateRow,
  SUGGESTED_SUBSCRIBE_SCENES,
  SUBSCRIBE_SEMANTIC_LABELS,
  SUBSCRIBE_SEMANTICS,
  type SubscribeTemplateRow,
} from '@/lib/wechat-apps';

const SEMANTIC_OPTIONS = SUBSCRIBE_SEMANTICS.map((name) => ({
  value: name,
  label: `${name}（${SUBSCRIBE_SEMANTIC_LABELS[name]}）`,
}));

/**
 * 订阅消息模板编辑器。
 *
 * 模板 ID 与字段名都只有小程序后台才有，所以这里按「场景 → 模板 ID + 字段映射」
 * 手填。字段映射的取值被限制在 `SUBSCRIBE_SEMANTICS` 内 —— 后端只上报这几个
 * 语义值，映射到别的名字微信不报错但会渲染成空串。
 *
 * 用户点开消息会进顾客订单详情（scope=mine）。
 */
export function SubscribeTemplateEditor({
  rows,
  onChange,
}: {
  rows: SubscribeTemplateRow[];
  onChange: (rows: SubscribeTemplateRow[]) => void;
}) {
  const used = new Set(rows.map((row) => row.scene.trim()));
  const suggestions = SUGGESTED_SUBSCRIBE_SCENES.filter(
    (item) => !used.has(item.scene),
  );

  const patch = (index: number, next: Partial<SubscribeTemplateRow>) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...next } : row)));
  };

  const patchField = (
    rowIndex: number,
    fieldIndex: number,
    next: Partial<{ field: string; semantic: string }>,
  ) => {
    onChange(
      rows.map((row, i) =>
        i === rowIndex
          ? {
              ...row,
              fields: row.fields.map((pair, j) =>
                j === fieldIndex ? { ...pair, ...next } : pair,
              ),
            }
          : row,
      ),
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <Label>订阅消息模板（点开进顾客订单详情）</Label>
          <p className="text-xs text-muted-foreground">
            在微信公众平台「订阅消息」按关键词选用模板，把模板 ID
            粘到下方；字段名以所选模板为准（与预填不一致时改左侧字段名）。未配置的场景不会发送。
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...rows, emptyTemplateRow()])}
        >
          <Plus />
          场景
        </Button>
      </div>

      {suggestions.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">快捷添加</span>
          {suggestions.map((item) => (
            <Button
              key={item.scene}
              type="button"
              variant="ghost"
              size="xs"
              title={`${item.titleHint}；搜「${item.keywordHint}」`}
              onClick={() =>
                onChange([
                  ...rows,
                  emptyTemplateRow(item.scene, '', item.fields),
                ])
              }
            >
              <Plus />
              {item.label}
            </Button>
          ))}
        </div>
      ) : null}

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
          尚未配置模板，用户收不到任何订阅消息
        </p>
      ) : null}

      <div className="space-y-3">
        {rows.map((row, index) => (
          <div key={index} className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <Input
                value={row.scene}
                onChange={(e) => patch(index, { scene: e.target.value })}
                placeholder="场景名，如 PRICE_OFFERED"
                className="font-mono text-xs"
                aria-label="场景名"
              />
              <Input
                value={row.templateId}
                onChange={(e) => patch(index, { templateId: e.target.value })}
                placeholder="微信模板 ID"
                className="font-mono text-xs"
                aria-label="模板 ID"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="删除该场景"
                onClick={() =>
                  onChange(rows.filter((_, i) => i !== index))
                }
              >
                <Trash2 />
              </Button>
            </div>
            {(() => {
              const hint = SUGGESTED_SUBSCRIBE_SCENES.find(
                (item) => item.scene === row.scene.trim(),
              );
              return hint ? (
                <p className="text-[11px] text-muted-foreground">
                  {hint.label} · 搜「{hint.keywordHint}」· {hint.titleHint}
                </p>
              ) : null;
            })()}

            <div className="space-y-1.5 pl-1">
              <span className="text-xs text-muted-foreground">
                字段映射（微信字段名 ← 业务语义；须与所选模板字段一致）
              </span>
              {row.fields.map((pair, fieldIndex) => (
                <div key={fieldIndex} className="flex items-center gap-2">
                  <Input
                    value={pair.field}
                    onChange={(e) =>
                      patchField(index, fieldIndex, { field: e.target.value })
                    }
                    placeholder="模板字段 thing1"
                    className="h-7 w-32 font-mono text-xs"
                    aria-label="模板字段名"
                  />
                  <span className="text-xs text-muted-foreground">←</span>
                  <Select
                    items={SEMANTIC_OPTIONS}
                    value={pair.semantic}
                    onValueChange={(next) => {
                      if (typeof next === 'string') {
                        patchField(index, fieldIndex, { semantic: next });
                      }
                    }}
                  >
                    <SelectTrigger size="sm" className="font-mono text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SEMANTIC_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label="删除该字段"
                    onClick={() =>
                      patch(index, {
                        fields: row.fields.filter((_, j) => j !== fieldIndex),
                      })
                    }
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() =>
                  patch(index, {
                    fields: [...row.fields, { field: '', semantic: 'orderCode' }],
                  })
                }
              >
                <Plus />
                字段
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
