import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import {
  MQTT_PATTERNS,
  optionalString,
  requiredString,
  RECYCLE_CLIENT,
  rpcFail,
} from '@app/common';
import { DataSource, Repository } from 'typeorm';
import {
  Actor,
  actorToSession,
  ApprovalDecision,
  ApprovalStatus,
  ApprovalType,
  internalPayload,
  requireInternal,
} from '../domain';
import { RECYCLE_ROLES } from '../domain/roles';
import {
  RecycleApprovalRecordEntity,
  RecycleApprovalTaskEntity,
} from '../entities';

/** 需要审批员决策的任务，统一由审批员角色承接 */
const APPROVER_ROLE = RECYCLE_ROLES.APPROVER;

function readDecision(value: unknown): ApprovalDecision {
  const raw = optionalString(value);
  if (
    !raw ||
    !Object.values(ApprovalDecision).includes(raw as ApprovalDecision)
  ) {
    rpcFail(400, 'decision 必须是 accept / reject / reprice');
  }
  return raw as ApprovalDecision;
}

function readPrice(payload: Record<string, unknown>): number | null {
  if (
    payload.price === undefined ||
    payload.price === null ||
    payload.price === ''
  ) {
    return null;
  }
  const value = Number(payload.price);
  if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    rpcFail(400, 'price 必须是大于 0 的整数（单位：分）');
  }
  return value;
}

/**
 * 审批上下文。
 *
 * 边界：只管「人做决策」这件事 —— 待办、指派、结论、留痕。
 * 不 import 订单模块，也不懂订单状态机：出结论后发事件，由订单侧自己推进状态。
 */
@Injectable()
export class ApprovalsService {
  private readonly logger = new Logger('RecycleApprovals');

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(RecycleApprovalTaskEntity)
    private readonly tasks: Repository<RecycleApprovalTaskEntity>,
    @InjectRepository(RecycleApprovalRecordEntity)
    private readonly recordRepo: Repository<RecycleApprovalRecordEntity>,
    @Inject(RECYCLE_CLIENT) private readonly bus: ClientProxy,
  ) {}

  /** 内部事件：订单侧请求审批 */
  async request(payload: Record<string, unknown>) {
    requireInternal(payload);
    const bizCode = requiredString(payload._bizCode, '_bizCode');
    const orderId = requiredString(payload.orderId, 'orderId');
    const type = optionalString(payload.type) as ApprovalType | undefined;
    const requestedBy = requiredString(payload.requestedBy, 'requestedBy');
    if (!type || !Object.values(ApprovalType).includes(type)) {
      rpcFail(400, '审批类型不合法');
    }

    // 幂等：同一订单同类型已有待办则不重复创建
    const existing = await this.tasks.findOne({
      where: { orderId, type, status: ApprovalStatus.PENDING },
    });
    if (existing) {
      return existing;
    }

    const assigneeId = optionalString(payload.assigneeId) ?? null;
    return this.tasks.save(
      this.tasks.create({
        bizCode,
        orderId,
        type,
        status: ApprovalStatus.PENDING,
        assigneeRole: APPROVER_ROLE,
        assigneeId,
        requestedBy,
        payload:
          payload.payload && typeof payload.payload === 'object'
            ? (payload.payload as Record<string, unknown>)
            : {},
      }),
    );
  }

  async list(
    actor: Actor,
    bizCode: string,
    query: Record<string, unknown> = {},
  ) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 20));
    const statusRaw = optionalString(query.status);
    const status =
      statusRaw &&
      Object.values(ApprovalStatus).includes(statusRaw as ApprovalStatus)
        ? (statusRaw as ApprovalStatus)
        : ApprovalStatus.PENDING;

    const where: Record<string, unknown> = { bizCode, status };
    // 非超管 / 非审批员只能看到自己发起的
    if (
      !actor.roles.includes(RECYCLE_ROLES.ADMIN) &&
      !actor.roles.includes(APPROVER_ROLE)
    ) {
      where.requestedBy = actor.userId;
    }

    const [rows, total] = await this.tasks.findAndCount({
      where,
      order: { createdAt: 'ASC' },
      take: pageSize,
      skip: (page - 1) * pageSize,
    });
    return {
      items: rows.map((row) => this.toTaskView(row)),
      total,
      page,
      pageSize,
    };
  }

  async detail(actor: Actor, bizCode: string, id: string) {
    const task = await this.loadTask(actor, bizCode, id);
    return this.toTaskView(task);
  }

  async records(actor: Actor, bizCode: string, id: string) {
    const task = await this.loadTask(actor, bizCode, id);
    const rows = await this.recordRepo.find({
      where: { taskId: task.id },
      order: { createdAt: 'ASC' },
    });
    return rows.map((row) => ({
      id: row.id,
      decision: row.decision,
      price: row.price,
      reason: row.reason,
      actorId: row.actorId,
      actorRoles: row.actorRoles,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  /**
   * 出审批结论。
   *
   * 三条普通 CRUD 没有的约束：
   *  1. 指派制 —— 有指派人时必须是本人，未指派时必须有对应角色；
   *  2. 职责分离 —— 不能审自己发起的申请；
   *  3. 金额留痕 —— reprice 必须给出新报价。
   */
  async decide(
    actor: Actor,
    bizCode: string,
    id: string,
    payload: Record<string, unknown>,
  ) {
    const task = await this.loadTask(actor, bizCode, id);

    if (!actor.roles.includes(APPROVER_ROLE)) {
      rpcFail(403, '只有审批员可以出具审批结论');
    }
    if (task.status !== ApprovalStatus.PENDING) {
      rpcFail(409, '该审批任务已结束');
    }
    if (task.assigneeId && task.assigneeId !== actor.userId) {
      rpcFail(403, '该审批任务已指派给其他审批员');
    }
    if (task.requestedBy === actor.userId) {
      rpcFail(403, '不能审批自己发起的申请');
    }

    const decision = readDecision(payload.decision);
    const price =
      decision === ApprovalDecision.REPRICE ? readPrice(payload) : null;
    if (decision === ApprovalDecision.REPRICE && price === null) {
      rpcFail(400, 'reprice 必须给出新报价');
    }
    const reason = optionalString(payload.reason) ?? null;

    return this.dataSource.transaction(async (manager) => {
      const saved = await manager.save(RecycleApprovalTaskEntity, {
        ...task,
        status:
          decision === ApprovalDecision.REJECT
            ? ApprovalStatus.REJECTED
            : ApprovalStatus.APPROVED,
        decidedBy: actor.userId,
        decidedAt: new Date(),
        updatedAt: new Date(),
      });
      await manager.save(
        RecycleApprovalRecordEntity,
        manager.create(RecycleApprovalRecordEntity, {
          taskId: task.id,
          orderId: task.orderId,
          actorId: actor.userId,
          actorRoles: actor.roles,
          decision,
          price,
          reason,
        }),
      );

      // 结论以事件回传订单侧，本服务不直接改订单
      this.publish(
        MQTT_PATTERNS.RECYCLE_EVT_APPROVAL_DECIDED,
        internalPayload({
          _bizCode: bizCode,
          _session: actorToSession(actor),
          orderId: task.orderId,
          taskId: task.id,
          decision,
          price,
          reason,
        }),
      );

      return this.toTaskView(saved);
    });
  }

  /** 取消待办：订单作废或不再需要审批时由审批员 / 超管关闭 */
  async cancel(
    actor: Actor,
    bizCode: string,
    id: string,
    payload: Record<string, unknown>,
  ) {
    const task = await this.loadTask(actor, bizCode, id);
    if (
      !actor.roles.includes(APPROVER_ROLE) &&
      !actor.roles.includes(RECYCLE_ROLES.ADMIN)
    ) {
      rpcFail(403, '没有权限取消审批任务');
    }
    if (task.status !== ApprovalStatus.PENDING) {
      rpcFail(409, '该审批任务已结束');
    }
    const reason = optionalString(payload.reason) ?? null;
    const saved = await this.tasks.save({
      ...task,
      status: ApprovalStatus.CANCELLED,
      decidedBy: actor.userId,
      decidedAt: new Date(),
      updatedAt: new Date(),
    });
    await this.recordRepo.save(
      this.recordRepo.create({
        taskId: task.id,
        orderId: task.orderId,
        actorId: actor.userId,
        actorRoles: actor.roles,
        decision: 'cancel',
        price: null,
        reason,
      }),
    );
    return this.toTaskView(saved);
  }

  // ---------------------------------------------------------------- 内部

  private async loadTask(
    actor: Actor,
    bizCode: string,
    id: string,
  ): Promise<RecycleApprovalTaskEntity> {
    const task = await this.tasks.findOne({ where: { id } });
    if (!task || task.bizCode !== bizCode) {
      rpcFail(404, '审批任务不存在');
    }
    const visible =
      actor.roles.includes(RECYCLE_ROLES.ADMIN) ||
      actor.roles.includes(APPROVER_ROLE) ||
      task.requestedBy === actor.userId ||
      task.assigneeId === actor.userId;
    if (!visible) {
      rpcFail(404, '审批任务不存在');
    }
    return task;
  }

  private toTaskView(task: RecycleApprovalTaskEntity) {
    return {
      id: task.id,
      orderId: task.orderId,
      type: task.type,
      status: task.status,
      assigneeRole: task.assigneeRole,
      assigneeId: task.assigneeId,
      requestedBy: task.requestedBy,
      payload: task.payload,
      decidedBy: task.decidedBy,
      decidedAt: task.decidedAt ? task.decidedAt.toISOString() : null,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };
  }

  private publish(pattern: string, data: Record<string, unknown>) {
    this.bus.emit(pattern, data).subscribe({
      error: (err: unknown) =>
        this.logger.error(
          `审批事件发送失败 ${pattern}: ${err instanceof Error ? err.message : String(err)}`,
        ),
    });
  }
}
