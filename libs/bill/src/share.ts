import { z } from 'zod';

export const ItemPriceSchema = z.object({
  index: z.number().int().nonnegative(),
  name: z.string().min(1),
  quantity: z.number().int().positive(),
  originalSubtotal: z.number().int().nonnegative(),
  itemDiscount: z.number().int().nonnegative(),
  orderDiscountShare: z.number().int().nonnegative(),
  deliveryShare: z.number().int().nonnegative(),
  packingShare: z.number().int().nonnegative(),
  bearsPacking: z.boolean().optional().default(true),
  finalAmount: z.number().int(),
  finalUnitPrice: z.number().int(),
});

export const BundlePickSchema = z.object({
  index: z.number().int().nonnegative(),
  quantity: z.number().int().positive(),
});

export const SplitPayloadSchema = z.object({
  orderPaidTotal: z.number().int().nonnegative().optional(),
  bundlePaidTotal: z.number().int().nonnegative().optional(),
  paidTotal: z.number().int().nonnegative(),
  items: z.array(ItemPriceSchema).min(1),
  bundleIndexes: z.array(z.number().int().nonnegative()).optional(),
  bundlePicks: z.array(BundlePickSchema).optional(),
});

export const CreateShareBodySchema = SplitPayloadSchema.extend({
  focusIndex: z.number().int().nonnegative().default(0),
  title: z.string().max(80).optional(),
  parentId: z.string().min(8).max(40).optional(),
});

export type ItemPriceDto = z.infer<typeof ItemPriceSchema>;
export type SplitPayload = z.infer<typeof SplitPayloadSchema>;
export type CreateShareBody = z.infer<typeof CreateShareBodySchema>;

/** 分享组合置顶，其余保持相对顺序 */
export function reorderWithBundle(
  items: ItemPriceDto[],
  bundleIndexes: number[],
): { items: ItemPriceDto[]; focusIndex: number; bundleIndexes: number[] } {
  const orderedBundle = bundleIndexes.filter((id, i, arr) => arr.indexOf(id) === i);
  const selected = orderedBundle
    .map((id) => items.find((item) => item.index === id))
    .filter((item): item is ItemPriceDto => Boolean(item));
  const selectedSet = new Set(selected.map((item) => item.index));
  const rest = items.filter((item) => !selectedSet.has(item.index));
  const nextItems = selected.length > 0 ? [...selected, ...rest] : items;
  const focusIndex = selected[0]?.index ?? nextItems[0]!.index;
  return {
    items: nextItems,
    focusIndex,
    bundleIndexes: selected.map((item) => item.index),
  };
}
