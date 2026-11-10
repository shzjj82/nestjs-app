import { ConversationMessageEntity } from './conversation-message.entity';
import { ConversationEntity } from './conversation.entity';
import { RagChunkEntity } from './rag-chunk.entity';
import { VisionImageEntity } from './vision-image.entity';
import { VisionJobEntity } from './vision-job.entity';

export const AGENTS_ENTITIES = [
  VisionJobEntity,
  VisionImageEntity,
  RagChunkEntity,
  ConversationEntity,
  ConversationMessageEntity,
];

export {
  ConversationEntity,
  ConversationMessageEntity,
  RagChunkEntity,
  VisionImageEntity,
  VisionJobEntity,
};
