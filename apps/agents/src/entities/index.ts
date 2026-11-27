import { ConversationEntity } from '../modules/conversations/entity/conversation.entity';
import { ConversationMessageEntity } from '../modules/conversations/entity/message.entity';
import { OcrCacheEntity } from '../modules/ocr/entity/cache.entity';
import { OcrJobEntity } from '../modules/ocr/entity/job.entity';
import { RagChunkEntity } from '../modules/rag/entity/chunk.entity';
import { PromptEntity } from '../modules/prompts/entity/prompt.entity';
import { VisionImageEntity } from '../modules/vision/entity/image.entity';
import { VisionJobEntity } from '../modules/vision/entity/job.entity';

export const AGENTS_ENTITIES = [
  VisionJobEntity,
  VisionImageEntity,
  RagChunkEntity,
  ConversationEntity,
  ConversationMessageEntity,
  OcrCacheEntity,
  OcrJobEntity,
  PromptEntity,
];

export {
  ConversationEntity,
  ConversationMessageEntity,
  OcrCacheEntity,
  OcrJobEntity,
  RagChunkEntity,
  VisionImageEntity,
  VisionJobEntity,
  PromptEntity,
};
