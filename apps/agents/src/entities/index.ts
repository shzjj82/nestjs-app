import { ConversationMessageEntity } from './conversation-message.entity';
import { ConversationEntity } from './conversation.entity';
import { OcrCacheEntity } from './ocr-cache.entity';
import { OcrJobEntity } from './ocr-job.entity';
import { RagChunkEntity } from './rag-chunk.entity';
import { VisionImageEntity } from './vision-image.entity';
import { VisionJobEntity } from './vision-job.entity';

export const AGENTS_ENTITIES = [
  VisionJobEntity,
  VisionImageEntity,
  RagChunkEntity,
  ConversationEntity,
  ConversationMessageEntity,
  OcrCacheEntity,
  OcrJobEntity,
];

export {
  ConversationEntity,
  ConversationMessageEntity,
  OcrCacheEntity,
  OcrJobEntity,
  RagChunkEntity,
  VisionImageEntity,
  VisionJobEntity,
};
