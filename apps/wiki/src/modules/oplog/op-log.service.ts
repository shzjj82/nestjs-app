import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { WIKI_BIZ_CODE, asRecord, optionalString, toPage } from '@app/common';
import { Repository } from 'typeorm';
import { WikiOpEventEntity } from '../../entities';

export type WikiOpWrite = {
  action: string;
  resourceType: string;
  resourceId: string;
  title?: string | null;
  outcome?: string;
  payload?: Record<string, unknown>;
  actorId?: string | null;
  actorUserId?: string | null;
  bizCode?: string;
};

@Injectable()
export class OpLogService {
  private readonly logger = new Logger(OpLogService.name);

  constructor(
    @InjectRepository(WikiOpEventEntity)
    private readonly events: Repository<WikiOpEventEntity>,
  ) {}

  /** 写失败只打 warn，不阻断主业务 */
  async write(input: WikiOpWrite): Promise<void> {
    try {
      await this.events.save(
        this.events.create({
          bizCode: input.bizCode ?? WIKI_BIZ_CODE,
          action: input.action,
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          actorId: input.actorId ?? null,
          actorUserId: input.actorUserId ?? null,
          title: input.title ?? null,
          outcome: input.outcome ?? 'success',
          payload: input.payload ?? {},
        }),
      );
    } catch (err) {
      this.logger.warn(
        `写操作日志失败 ${input.action}/${input.resourceId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  writeFromPayload(payload: Record<string, unknown>, input: Omit<WikiOpWrite, 'actorId' | 'actorUserId'>) {
    const session = asRecord(payload._session);
    return this.write({
      ...input,
      actorId: optionalString(session.accountId) ?? optionalString(payload.authorId) ?? null,
      actorUserId: optionalString(session.userId) ?? null,
      bizCode: optionalString(payload._bizCode) ?? WIKI_BIZ_CODE,
    });
  }

  async list(payload: Record<string, unknown>) {
    const page = toPage(payload.page, payload.pageSize);
    const bizCode = optionalString(payload._bizCode) ?? WIKI_BIZ_CODE;
    const qb = this.events
      .createQueryBuilder('e')
      .where('e.biz_code = :bizCode', { bizCode })
      .orderBy('e.created_at', 'DESC')
      .skip(page.skip)
      .take(page.pageSize);
    const resourceType = optionalString(payload.resourceType);
    const resourceId = optionalString(payload.resourceId);
    const actorId = optionalString(payload.actorId);
    const action = optionalString(payload.action);
    if (resourceType) {
      qb.andWhere('e.resource_type = :resourceType', { resourceType });
    }
    if (resourceId) {
      qb.andWhere('e.resource_id = :resourceId', { resourceId });
    }
    if (actorId) {
      qb.andWhere('e.actor_id = :actorId', { actorId });
    }
    if (action) {
      qb.andWhere('e.action = :action', { action });
    }
    const [rows, total] = await qb.getManyAndCount();
    return {
      items: rows.map((row) => ({
        id: row.id,
        bizCode: row.bizCode,
        action: row.action,
        resourceType: row.resourceType,
        resourceId: row.resourceId,
        actorId: row.actorId,
        actorUserId: row.actorUserId,
        title: row.title,
        outcome: row.outcome,
        payload: row.payload,
        createdAt: row.createdAt.toISOString(),
      })),
      total,
      page: page.page,
      pageSize: page.pageSize,
    };
  }
}
