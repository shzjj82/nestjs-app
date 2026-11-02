import { MediaJobEntity } from './media-job.entity';
import { RagChunkEntity } from './rag-chunk.entity';
import { VisionImageEntity } from './vision-image.entity';
import { VisionJobEntity } from './vision-job.entity';

export const AGENTS_ENTITIES = [VisionJobEntity, VisionImageEntity, RagChunkEntity, MediaJobEntity];

export { MediaJobEntity, RagChunkEntity, VisionImageEntity, VisionJobEntity };
