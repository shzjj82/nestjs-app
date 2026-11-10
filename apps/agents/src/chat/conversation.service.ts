import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type {
  AgentChatAttachment,
  AgentChatRole,
  AgentConversationDetail,
  AgentConversationInfo,
  AgentConversationListResult,
  AgentConversationMessageInfo,
  AgentRagSource,
} from '@app/common';
import { toPage } from '@app/common';
import { Repository } from 'typeorm';
import { requireBizCode } from '../common/biz-scope';
import { asRecord, optionalString, requiredString, rpcFail } from '../common/rpc';
import { ConversationMessageEntity } from '../entities/conversation-message.entity';
import { ConversationEntity } from '../entities/conversation.entity';
import type { NormalizedMessage } from './chat-messages';
import {
  CONVERSATION_HISTORY_LIMIT,
  mergeConversationHistory,
} from './conversation-history';

@Injectable()
export class ConversationService {
  constructor(
    @InjectRepository(ConversationEntity)
    private readonly conversations: Repository<ConversationEntity>,
    @InjectRepository(ConversationMessageEntity)
    private readonly messages: Repository<ConversationMessageEntity>,
  ) {}

  async list(payload: unknown): Promise<AgentConversationListResult> {
    const { bizCode, userId } = this.requireActor(payload);
    const data = asRecord(payload);
    const { page, pageSize, skip } = toPage(data.page, data.pageSize);
    const [rows, total] = await this.conversations.findAndCount({
      where: { bizCode, userId },
      order: { updatedAt: 'DESC' },
      skip,
      take: pageSize,
    });
    return {
      items: rows.map((row) => this.toInfo(row)),
      total,
      page,
      pageSize,
    };
  }

  async findOne(payload: unknown): Promise<AgentConversationDetail> {
    const { bizCode, userId } = this.requireActor(payload);
    const id = requiredString(asRecord(payload).id, 'id');
    const row = await this.requireOwned(id, bizCode, userId);
    const messages = await this.messages.find({
      where: { conversationId: row.id },
      order: { createdAt: 'ASC' },
    });
    return {
      ...this.toInfo(row),
      messages: messages.map((item) => this.toMessage(item)),
    };
  }

  async rename(payload: unknown): Promise<AgentConversationInfo> {
    const { bizCode, userId } = this.requireActor(payload);
    const data = asRecord(payload);
    const id = requiredString(data.id, 'id');
    const title = requiredString(data.title, 'title').slice(0, 120);
    const row = await this.requireOwned(id, bizCode, userId);
    row.title = title;
    return this.toInfo(await this.conversations.save(row));
  }

  async remove(payload: unknown): Promise<{ ok: true }> {
    const { bizCode, userId } = this.requireActor(payload);
    const id = requiredString(asRecord(payload).id, 'id');
    const row = await this.requireOwned(id, bizCode, userId);
    await this.conversations.remove(row);
    return { ok: true };
  }

  async resolveForChat(input: {
    conversationId: string | undefined;
    bizCode: string;
    userId: string;
    accountId?: string;
  }): Promise<ConversationEntity> {
    if (input.conversationId) {
      return this.requireOwned(input.conversationId, input.bizCode, input.userId);
    }
    return this.conversations.save(
      this.conversations.create({
        bizCode: input.bizCode,
        userId: input.userId,
        accountId: input.accountId ?? null,
        title: '新对话',
      }),
    );
  }

  async loadHistory(conversationId: string): Promise<NormalizedMessage[]> {
    const rows = await this.messages.find({
      where: { conversationId },
      order: { createdAt: 'DESC' },
      take: CONVERSATION_HISTORY_LIMIT,
    });
    return rows.reverse().map((row) => ({
      role: row.role,
      content: row.content,
    }));
  }

  mergeHistory(
    history: NormalizedMessage[],
    incoming: NormalizedMessage[],
  ): NormalizedMessage[] {
    return mergeConversationHistory(history, incoming);
  }

  async appendTurn(input: {
    conversation: ConversationEntity;
    userContent: string;
    assistantContent: string;
    attachments?: AgentChatAttachment[];
    sources?: AgentRagSource[];
  }): Promise<void> {
    const { conversation } = input;
    const isFirst = !(await this.messages.exist({
      where: { conversationId: conversation.id },
    }));
    await this.messages.save([
      this.messages.create({
        conversationId: conversation.id,
        role: 'user' as AgentChatRole,
        content: input.userContent,
        attachments: input.attachments?.length ? input.attachments : null,
        sources: null,
      }),
      this.messages.create({
        conversationId: conversation.id,
        role: 'assistant' as AgentChatRole,
        content: input.assistantContent,
        attachments: null,
        sources: input.sources?.length ? input.sources : null,
      }),
    ]);
    if (isFirst || conversation.title === '新对话') {
      conversation.title =
        input.userContent.replace(/\s+/g, ' ').trim().slice(0, 40) || '新对话';
    }
    conversation.updatedAt = new Date();
    await this.conversations.save(conversation);
  }

  requireActor(payload: unknown): {
    bizCode: string;
    userId: string;
    accountId?: string;
  } {
    const bizCode = requireBizCode(payload);
    const session = asRecord(asRecord(payload)._session);
    const userId = optionalString(session.userId);
    if (!userId) {
      rpcFail(401, '需要登录会话');
    }
    return {
      bizCode,
      userId,
      accountId: optionalString(session.accountId),
    };
  }

  private async requireOwned(
    id: string,
    bizCode: string,
    userId: string,
  ): Promise<ConversationEntity> {
    const row = await this.conversations.findOne({ where: { id } });
    if (!row || row.bizCode !== bizCode || row.userId !== userId) {
      rpcFail(404, '会话不存在');
    }
    return row;
  }

  private toInfo(row: ConversationEntity): AgentConversationInfo {
    return {
      id: row.id,
      title: row.title,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toMessage(row: ConversationMessageEntity): AgentConversationMessageInfo {
    return {
      id: row.id,
      role: row.role,
      content: row.content,
      attachments: row.attachments,
      sources: row.sources,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
