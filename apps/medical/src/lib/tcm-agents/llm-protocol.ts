/** 模型族协议在 @app/common，业务侧不要再抄一份。 */
export {
  detectLlmFamily,
  isReasoningModel,
  buildChatBody,
  textFromStreamData,
  textFromDelta,
  textFromMessage,
} from '@app/common';
export type { LlmFamily } from '@app/common';
