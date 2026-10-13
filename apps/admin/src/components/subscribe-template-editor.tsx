'use client';

import { useState } from 'react';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  emptyTemplateRow,
  SUGGESTED_SUBSCRIBE_SCENES,
  SUBSCRIBE_SEMANTIC_LABELS,
  SUBSCRIBE_SEMANTICS,
  type SubscribeTemplateRow,
} from '@/lib/wechat-apps';

/**
 * 订阅消息模板编辑器。
 *
 * 性能注意：字段映射默认折叠，避免弹层打开时挂载大量自定义 Select
 * （4 场景 × 5 字段在 Base UI Select + backdrop-blur 下会明显卡顿）。
 */
export function SubscribeTemplateEditor({
  rows,
  onChange,
}: {
  rows: SubscribeTemplateRow[];
  onChange: (rows: SubscribeTemplateRow[]) => void;
}) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
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
            粘贴公众平台模板 ID；字段映射默认收起，需要时再展开改。
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

      <div className="space-y-2">
        {rows.map((row, index) => {
          const hint = SUGGESTED_SUBSCRIBE_SCENES.find(
            (item) => item.scene === row.scene.trim(),
          );
          const open = !!expanded[index];
          return (
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
                  onChange={(e) =>
                    patch(index, { templateId: e.target.value })
                  }
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
              {hint ? (
                <p className="text-[11px] text-muted-foreground">
                  {hint.label} · 搜「{hint.keywordHint}」
                </p>
              ) : null}

              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="h-7 px-1 text-muted-foreground"
                onClick={() =>
                  setExpanded((prev) => ({ ...prev, [index]: !prev[index] }))
                }
              >
                <ChevronDown
                  className={`size-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
                />
                字段映射（{row.fields.length}）
              </Button>

              {open ? (
                <div className="space-y-1.5 pl-1">
                  <span className="text-xs text-muted-foreground">
                    微信字段名 ← 业务语义（须与所选模板字段一致）
                  </span>
                  {row.fields.map((pair, fieldIndex) => (
                    <div key={fieldIndex} className="flex items-center gap-2">
                      <Input
                        value={pair.field}
                        onChange={(e) =>
                          patchField(index, fieldIndex, {
                            field: e.target.value,
                          })
                        }
                        placeholder="模板字段 thing1"
                        className="h-7 w-36 font-mono text-xs"
                        aria-label="模板字段名"
                      />
                      <span className="text-xs text-muted-foreground">←</span>
                      {/* 原生 select：比 Base UI Select 轻一个数量级，避免弹层卡顿 */}
                      <select
                        value={pair.semantic}
                        onChange={(e) =>
                          patchField(index, fieldIndex, {
                            semantic: e.target.value,
                          })
                        }
                        className="h-7 min-w-[9rem] flex-1 rounded-md border border-input bg-transparent px-2 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
                        aria-label="业务语义"
                      >
                        {SUBSCRIBE_SEMANTICS.map((name) => (
                          <option key={name} value={name}>
                            {name}（{SUBSCRIBE_SEMANTIC_LABELS[name]}）
                          </option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label="删除该字段"
                        onClick={() =>
                          patch(index, {
                            fields: row.fields.filter(
                              (_, j) => j !== fieldIndex,
                            ),
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
                        fields: [
                          ...row.fields,
                          { field: '', semantic: 'orderCode' },
                        ],
                      })
                    }
                  >
                    <Plus />
                    字段
                  </Button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
