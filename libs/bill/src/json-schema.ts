import { zodToJsonSchema } from 'zod-to-json-schema'
import { BillDraftSchema } from './schema'

/** 供 LLM / 文档对齐的 JSON Schema */
export const billDraftJsonSchema = zodToJsonSchema(BillDraftSchema, {
  name: 'BillDraft',
  $refStrategy: 'none',
})
