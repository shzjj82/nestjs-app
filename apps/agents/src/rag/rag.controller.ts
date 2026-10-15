import { Controller, Logger, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { AgentsHandleLogInterceptor, ApiDoc, MQTT_PATTERNS } from '@app/common';
import { agentsPattern } from '../common/rpc';
import { RagService } from './rag.service';

@Controller()
@UseInterceptors(AgentsHandleLogInterceptor)
export class RagController {
  private readonly logger = new Logger('AgentsRagCtrl');

  constructor(private readonly rag: RagService) {}

  @MessagePattern(agentsPattern(MQTT_PATTERNS.AGENTS_RAG_INDEX))
  @ApiDoc({ name: '索引文档', description: '内部：docs 保存后重建向量分块' })
  async index(payload: unknown) {
    try {
      return await this.rag.indexDocument(payload);
    } catch (err) {
      this.logger.error(
        `index failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { chunks: 0, error: true };
    }
  }

  @MessagePattern(agentsPattern(MQTT_PATTERNS.AGENTS_RAG_DELETE))
  @ApiDoc({ name: '删除文档索引', description: '内部：docs 删除后清理向量' })
  async remove(payload: unknown) {
    try {
      return await this.rag.deleteFromPayload(payload);
    } catch (err) {
      this.logger.error(
        `delete index failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { deleted: 0, error: true };
    }
  }

  @MessagePattern(agentsPattern(MQTT_PATTERNS.AGENTS_RAG_DELETE_BY_SOURCE))
  @ApiDoc({
    name: '按附件删除索引',
    description: '内部：文档去掉附件或 OSS 删对象后清理对应向量',
  })
  async removeBySource(payload: unknown) {
    try {
      return await this.rag.deleteBySource(payload);
    } catch (err) {
      this.logger.error(
        `delete by source failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { deleted: 0, error: true };
    }
  }

  @MessagePattern(agentsPattern(MQTT_PATTERNS.AGENTS_RAG_SEARCH))
  @ApiDoc({
    name: '文档向量检索',
    description: '按当前业务与账号可见范围检索文档分块',
  })
  search(payload: unknown) {
    return this.rag.search(payload);
  }
}
