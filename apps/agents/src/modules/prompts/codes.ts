/** 提示词编号。正文在数据库，这里只保留查找用的 code。 */
export const PROMPT_CODES = {
  chatDefault: 'chat.default',
  chatRagGrounded: 'chat.rag.grounded',
  chatRagGroundedOutside: 'chat.rag.grounded-outside',
  chatRagGeneral: 'chat.rag.general',
  chatWeb: 'chat.web',
  chatTodo: 'chat.todo',
  ocrImage: 'ocr.image',
} as const;

export type PromptCode = (typeof PROMPT_CODES)[keyof typeof PROMPT_CODES];
