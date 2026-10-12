import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import {
  MQTT_PATTERNS,
  optionalString,
  requiredString,
  RECYCLE_CLIENT,
  rpcFail,
  WECHAT_CLIENT,
} from '@app/common';
import { catchError, of } from 'rxjs';
import { DataSource, Repository } from 'typeorm';
import {
  Actor,
  ApprovalType,
  AuditResult,
  internalPayload,
  isOrderStatus,
  OrderItemInput,
  ORDER_STATUS_LABELS,
  OrderStatus,
  requireActor,
  requireInternal,
} from '../domain';
import { CatalogService } from '../catalog/catalog.service';
import {
  RecycleAuditReportEntity,
  RecycleOrderEntity,
  RecycleOrderEventEntity,
  RecycleOrderItemEntity,
  toOrderSnapshot,
} from '../entities';
import { LiveRolesService } from '../identity/live-roles.service';
import { OrderPolicyService } from '../policy/policy.service';
import { OrderAction } from '../policy/transitions';
import {
  actorForOrderView,
  canAccessOrder,
  customerScope,
  resolveOrderView,
  staffScope,
  type OrderScope,
  type OrderView,
} from './order-scope';
import { readOrderLines } from './order-items';
import { toOrderView } from './order-view';
import { isCustomerOnly, requireStaff } from '../domain';

const ACTION_TITLES: Record<OrderAction, string> = {
  quote: '已获取预估报价',
  submit: '已提交商品信息',
  receive: '业务员已确认收货',
  evaluate: '已完成验收评估',
  reject_inspect: '验收未通过',
  negotiate: '已发起协商定价',
  accept: '已同意报价',
  reject_offer: '已拒绝报价',
  transfer: '回收款已转出',
  return: '退货已完成',
  decide: '审批已决策',
};

/**
 * 动作 → 订阅消息场景。
 * 只通知「用户需要被动知晓」的节点；用户自己点的动作（quote / submit / negotiate）不发。
 */
const NOTICE_SCENES: Partial<Record<OrderAction, string>> = {
  evaluate: 'PRICE_OFFERED',
  decide: 'NEGOTIATE_RESULT',
  transfer: 'PAID',
  return: 'RETURN',
};

/** 各场景要展示的金额字段 */
const NOTICE_AMOUNT_FIELD: Record<string, keyof RecycleOrderEntity> = {
  PRICE_OFFERED: 'bOfferPrice',
  NEGOTIATE_RESULT: 'bOfferPrice',
  PAID: 'finalPrice',
  RETURN: 'estimatePrice',
};

/** 写入事件时剔除保留字段，避免把会话/密钥落库 */
const RESERVED_PAYLOAD_KEYS = [
  '_session',
  '_token',
  '_bizCode',
  '_internal',
  '_docsPrivileged',
];

function sanitizePayload(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (!RESERVED_PAYLOAD_KEYS.includes(key)) {
      out[key] = value;
    }
  }
  return out;
}

function readStringArray(value: unknown, max = 20): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === 'string')
    .slice(0, max);
}

function readAuditItems(
  value: unknown,
): Array<{ name: string; pass: boolean; note?: string }> {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((entry) => {
    const row = (entry ?? {}) as Record<string, unknown>;
    return {
      name: typeof row.name === 'string' ? row.name : '',
      pass: row.pass === true,
      note: optionalString(row.note),
    };
  });
}

function genOrderCode(): string {
  const now = new Date();
  const ymd = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('');
  return `RC${ymd}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

/**
 * 转账流水号：服务端生成，不接受客户端传值。
 * 等接入微信商家转账后，这里应换成微信返回的批次号 / 微信明细单号；
 * 在那之前先由服务端出号，避免前端随便填一个。
 */
function genBillNo(): string {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('');
  return `TB${stamp}${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
}

function actionTitle(
  action: OrderAction,
  payload: Record<string, unknown>,
): string {
  if (action === 'decide') {
    const decision = optionalString(payload.decision);
    if (decision === 'reprice') {
      return '审批员重新定价';
    }
    if (decision === 'accept') {
      return '审批员接受协商价';
    }
    return '审批员拒绝协商';
  }
  return ACTION_TITLES[action] ?? action;
}

/**
 * 订单上下文。
 *
 * 边界：
 *  - 只依赖 PolicyModule 做授权，不自己写 if (role === ...) 判断；
 *  - 不 import 审批模块，需要审批时发内部事件，审批结论也以事件回来。
 */
@Injectable()
export class OrdersService {
  private readonly logger = new Logger('RecycleOrders');

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(RecycleOrderEntity)
    private readonly orders: Repository<RecycleOrderEntity>,
    @InjectRepository(RecycleOrderItemEntity)
    private readonly orderItems: Repository<RecycleOrderItemEntity>,
    @InjectRepository(RecycleOrderEventEntity)
    private readonly events: Repository<RecycleOrderEventEntity>,
    @InjectRepository(RecycleAuditReportEntity)
    private readonly audits: Repository<RecycleAuditReportEntity>,
    @Inject(RECYCLE_CLIENT) private readonly bus: ClientProxy,
    /** 单向依赖：只用来发订阅消息，wechat 不认识订单 */
    @Inject(WECHAT_CLIENT) private readonly wechat: ClientProxy,
    private readonly policy: OrderPolicyService,
    /** 单向依赖：只用来查目录价，目录不认识订单 */
    private readonly catalog: CatalogService,
    private readonly liveRoles: LiveRolesService,
  ) {}

  // ---------------------------------------------------------------- 读

  /** 个人中心：当前用户自己的订单 */
  async listMine(
    actor: Actor,
    bizCode: string,
    query: Record<string, unknown> = {},
  ) {
    return this.listWithScope(
      actor,
      customerScope(actor, bizCode),
      'customer',
      query,
    );
  }

  /** 业务员工作台：业务内订单（需业务员 / 超管角色） */
  async listStaff(
    actor: Actor,
    bizCode: string,
    query: Record<string, unknown> = {},
  ) {
    actor = await this.liveRoles.requireStaff(actor, '查看业务订单');
    return this.listWithScope(
      actor,
      staffScope(actor, bizCode),
      'staff',
      query,
    );
  }

  /**
   * 兼容旧客户端：有业务员身份走工作台，否则走个人单。
   * 新客户端请分别用 /orders/mine 与 /orders/staff。
   */
  async list(
    actor: Actor,
    bizCode: string,
    query: Record<string, unknown> = {},
  ) {
    actor = await this.liveRoles.hydrate(actor);
    if (isCustomerOnly(actor)) {
      return this.listMine(actor, bizCode, query);
    }
    return this.listStaff(actor, bizCode, query);
  }

  private async listWithScope(
    actor: Actor,
    scope: OrderScope,
    view: 'customer' | 'staff',
    query: Record<string, unknown>,
  ) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 20));
    const statusRaw = optionalString(query.status);
    const status =
      statusRaw && isOrderStatus(statusRaw) ? statusRaw : undefined;

    const where = scope.where.map((clause) =>
      status ? { ...clause, status } : clause,
    );
    const [rows, total] = await this.orders.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: pageSize,
      skip: (page - 1) * pageSize,
    });
    return {
      items: rows.map((row) => this.toView(row, actor, view)),
      total,
      page,
      pageSize,
      view,
    };
  }

  async detail(
    actor: Actor,
    bizCode: string,
    id: string,
    payload: Record<string, unknown> = {},
  ) {
    actor = await this.liveRoles.hydrate(actor);
    const order = await this.loadVisible(actor, bizCode, id, payload);
    const items = await this.orderItems.find({
      where: { orderId: order.id },
      order: { sort: 'ASC' },
    });
    const view = this.viewOf(actor, bizCode, order, payload);
    return {
      ...this.toView(order, actor, view),
      items: items.map((item) => ({
        typeId: item.typeId,
        brandId: item.brandId,
        modelId: item.modelId,
        cartridgeType: item.cartridgeType,
        brand: item.brand,
        model: item.model,
        spec: item.spec,
        chip: item.chip,
        quantity: item.quantity,
        price: item.price,
      })),
    };
  }

  async timeline(
    actor: Actor,
    bizCode: string,
    id: string,
    payload: Record<string, unknown> = {},
  ) {
    actor = await this.liveRoles.hydrate(actor);
    const order = await this.loadVisible(actor, bizCode, id, payload);
    const rows = await this.events.find({
      where: { orderId: order.id },
      order: { createdAt: 'ASC' },
    });
    return rows.map((row) => ({
      at: row.createdAt.toISOString(),
      action: row.action,
      fromStatus: row.fromStatus,
      toStatus: row.toStatus,
      title: row.title,
      note: row.note,
      actorRoles: row.actorRoles,
    }));
  }

  async audit(
    actor: Actor,
    bizCode: string,
    id: string,
    payload: Record<string, unknown> = {},
  ) {
    actor = await this.liveRoles.hydrate(actor);
    const order = await this.loadVisible(actor, bizCode, id, payload);
    const report = await this.audits.findOne({ where: { orderId: order.id } });
    if (!report) {
      rpcFail(404, '该订单暂无审核报告');
    }
    const isStaff = this.viewOf(actor, bizCode, order, payload) === 'staff';
    return {
      result: report.result,
      items: report.items ?? [],
      note: report.note,
      suggestedPrice: report.suggestedPrice,
      photos: report.photos ?? [],
      internalNote: isStaff ? report.internalNote : undefined,
      createdAt: report.createdAt.toISOString(),
    };
  }

  // ---------------------------------------------------------------- 写

  async create(
    actor: Actor,
    bizCode: string,
    payload: Record<string, unknown>,
  ) {
    const inputs = await this.readItems(payload.items);
    const first = inputs[0];
    const totalQuantity = inputs.reduce((sum, item) => sum + item.quantity, 0);
    const estimatePrice = inputs.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    return this.dataSource.transaction(async (manager) => {
      const order = await manager.save(
        RecycleOrderEntity,
        manager.create(RecycleOrderEntity, {
          code: genOrderCode(),
          bizCode,
          ownerId: actor.userId,
          /**
           * openid 只认会话里那份（usercenter 用 code2session 换来的），
           * 客户端传的 openid 一律丢弃 —— 否则别人填你的 openid 就能把你的
           * 订阅消息 / 打款挪到自己头上。
           */
          ownerOpenid: actor.openid,
          wechatAppId: actor.wechatAppId,
          regionCode: optionalString(payload.regionCode) ?? actor.regionCode,
          status: OrderStatus.DRAFT,
          brand: first.brand,
          model: first.model,
          spec: first.spec ?? null,
          cartridgeType: first.cartridgeType,
          totalQuantity,
          estimatePrice,
          screenshots: [],
          logisticsNo: '',
        }),
      );
      await manager.save(
        RecycleOrderItemEntity,
        inputs.map((item, index) =>
          manager.create(RecycleOrderItemEntity, {
            ...item,
            orderId: order.id,
            sort: index,
          }),
        ),
      );
      await this.writeEvent(
        manager,
        order,
        'create',
        actor,
        null,
        OrderStatus.DRAFT,
        '已创建回收单',
        null,
        {
          totalQuantity,
          estimatePrice,
        },
      );
      return this.toView(order, actor, 'customer');
    });
  }

  /**
   * 执行订单动作。
   *
   * 授权 = 策略引擎（角色 ∩ 状态 ∩ 业务规则），并发控制靠 version 条件更新。
   */
  async perform(
    actor: Actor,
    bizCode: string,
    id: string,
    action: string,
    payload: Record<string, unknown>,
    options: { internal?: boolean } = {},
  ) {
    actor = await this.liveRoles.hydrate(actor);
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(RecycleOrderEntity, {
        where: { id, bizCode },
      });
      if (!order) {
        rpcFail(404, '订单不存在');
      }
      const view: OrderView = options.internal
        ? 'staff'
        : this.viewOf(actor, bizCode, order, payload);
      if (!canAccessOrder(actor, bizCode, order, view)) {
        // 越统一返回 404，避免用错误码探测订单是否存在
        rpcFail(404, '订单不存在');
      }

      const authorized = this.policy.authorize(
        action,
        {
          actor: actorForOrderView(actor, view),
          order: toOrderSnapshot(order),
          payload,
        },
        options,
      );

      const patch = this.buildPatch(authorized.action, order, payload, actor);

      const result = await manager
        .createQueryBuilder()
        .update(RecycleOrderEntity)
        // QueryBuilder.update 不会触发 @UpdateDateColumn，需显式写库时间
        .set({
          ...patch,
          status: authorized.to,
          version: order.version + 1,
          updatedAt: () => 'CURRENT_TIMESTAMP',
        })
        .where('id = :id', { id: order.id })
        .andWhere('version = :version', { version: order.version })
        .execute();
      if (!result.affected) {
        rpcFail(409, '订单已被其他人更新，请刷新后重试');
      }

      const saved = await manager.findOneOrFail(RecycleOrderEntity, {
        where: { id: order.id },
      });
      await this.persistSideEffects(manager, saved, authorized.action, payload);
      await this.writeEvent(
        manager,
        saved,
        authorized.action,
        actor,
        authorized.from,
        authorized.to,
        actionTitle(authorized.action, payload),
        optionalString(payload.note) ?? optionalString(payload.reason) ?? null,
        sanitizePayload(payload),
      );

      if (authorized.approval) {
        this.publishApprovalRequest(
          actor,
          bizCode,
          saved,
          authorized.approval,
          payload,
        );
      }

      this.publishNotice(saved, authorized.action);

      return this.toView(saved, actor, view);
    });
  }

  /**
   * 状态变更后给用户发一条订阅消息（fire-and-forget）。
   *
   * ⚠️ 通知失败绝不能影响订单流转：这里吞掉错误只记日志。
   * 另外用户可能压根没授权订阅（微信返回 43101），那也是正常情况。
   */
  private publishNotice(order: RecycleOrderEntity, action: OrderAction) {
    const scene = NOTICE_SCENES[action];
    if (!scene) {
      return;
    }
    if (!order.ownerOpenid || !order.wechatAppId) {
      this.logger.debug(
        `跳过通知 ${scene}：订单 ${order.code} 没有 openid 或 wechatAppId（非小程序下单）`,
      );
      return;
    }
    const amountField = NOTICE_AMOUNT_FIELD[scene];
    const amount = Number(order[amountField] ?? 0);
    this.wechat
      .send(MQTT_PATTERNS.WECHAT_SUBSCRIBE_SEND, {
        appId: order.wechatAppId,
        touser: order.ownerOpenid,
        scene,
        page: `pages/order/detail?id=${order.id}`,
        values: {
          orderCode: order.code,
          title: ACTION_TITLES[action],
          statusLabel: ORDER_STATUS_LABELS[order.status] ?? order.status,
          // 语义值用「元」，模板里怎么渲染由 wechat 服务的字段映射决定
          amount: (amount / 100).toFixed(2),
          at: new Date().toLocaleString('zh-CN'),
        },
      })
      .pipe(
        catchError((err: unknown) => {
          this.logger.warn(
            `订阅消息发送失败（已忽略）: ${scene} -> ${order.code} ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
          return of(null);
        }),
      )
      .subscribe();
  }

  /** 内部事件：审批结论回来后推进订单状态 */
  async applyDecision(payload: Record<string, unknown>) {
    requireInternal(payload);
    const actor = requireActor(payload);
    const bizCode = optionalString(payload._bizCode) ?? actor.bizCode;
    const orderId = requiredString(payload.orderId, 'orderId');
    return this.perform(actor, bizCode, orderId, 'decide', payload, {
      internal: true,
    });
  }

  // ---------------------------------------------------------------- 内部

  private async loadVisible(
    actor: Actor,
    bizCode: string,
    id: string,
    payload: Record<string, unknown> = {},
  ): Promise<RecycleOrderEntity> {
    const order = await this.orders.findOne({ where: { id } });
    if (!order) {
      rpcFail(404, '订单不存在');
    }
    const view = this.viewOf(actor, bizCode, order, payload);
    if (!canAccessOrder(actor, bizCode, order, view)) {
      rpcFail(404, '订单不存在');
    }
    return order;
  }

  private viewOf(
    actor: Actor,
    bizCode: string,
    order: RecycleOrderEntity,
    payload: Record<string, unknown>,
  ): OrderView {
    return resolveOrderView(actor, bizCode, order, payload.view);
  }

  private toView(
    order: RecycleOrderEntity,
    actor: Actor,
    view: OrderView,
  ) {
    const lens = actorForOrderView(actor, view);
    return toOrderView(
      order,
      lens,
      this.policy.availableActions(lens, toOrderSnapshot(order)),
      view,
    );
  }

  /**
   * 读明细 + 服务端定价。
   *
   * ⚠️ 客户端带来的 price / chip / spec 一律丢弃：价目表只认 `recycle_models`，
   * 否则用户改一个字段就能把 9 元的空墨盒报成 900 元。
   * 型号不在目录里直接 400。展示用预估由前端用目录单价 × 数量计算。
   */
  private async readItems(raw: unknown): Promise<OrderItemInput[]> {
    const requested = readOrderLines(raw);
    const priced = await this.catalog.priceItems(requested);
    return priced.map((line) => ({
      typeId: line.typeId,
      brandId: line.brandId,
      modelId: line.modelId,
      cartridgeType: line.cartridgeType,
      brand: line.brand,
      model: line.model,
      spec: line.spec || undefined,
      chip: line.chip,
      quantity: line.quantity,
      price: line.price,
    }));
  }

  /** 动作带来的业务字段变更；状态本身由策略引擎决定，这里不碰 */
  private buildPatch(
    action: OrderAction,
    order: RecycleOrderEntity,
    payload: Record<string, unknown>,
    actor: Actor,
  ): Partial<RecycleOrderEntity> {
    switch (action) {
      case 'submit':
        return {
          logisticsNo: requiredString(payload.logisticsNo, 'logisticsNo'),
          logisticsCompany: optionalString(payload.logisticsCompany) ?? null,
          screenshots: readStringArray(payload.screenshots),
        };
      case 'receive':
        return order.assignedAgentId ? {} : { assignedAgentId: actor.userId };
      case 'evaluate':
        return {
          bOfferPrice: Number(payload.price),
          bEvalNote: optionalString(payload.note) ?? null,
          internalNote: optionalString(payload.internalNote) ?? null,
        };
      case 'reject_inspect':
        return { bEvalNote: optionalString(payload.note) ?? null };
      case 'negotiate':
        return { negotiatePrice: Number(payload.price) };
      case 'accept':
        return { finalPrice: order.bOfferPrice };
      case 'transfer':
        return {
          // 流水号服务端出；客户端传的 billNo 不用
          transferBillNo: genBillNo(),
          paidAt: new Date(),
        };
      case 'return':
        return {
          returnLogisticsNo: requiredString(
            payload.returnLogisticsNo,
            'returnLogisticsNo',
          ),
        };
      case 'decide': {
        const decision = optionalString(payload.decision);
        if (decision === 'accept') {
          return {
            bOfferPrice: order.negotiatePrice,
            finalPrice: order.negotiatePrice,
            negotiatePrice: null,
          };
        }
        if (decision === 'reprice') {
          return { bOfferPrice: Number(payload.price), negotiatePrice: null };
        }
        return { negotiatePrice: null };
      }
      default:
        return {};
    }
  }

  private async persistSideEffects(
    manager: import('typeorm').EntityManager,
    order: RecycleOrderEntity,
    action: OrderAction,
    payload: Record<string, unknown>,
  ) {
    if (action === 'evaluate') {
      const price = Number(payload.price);
      await manager.upsert(
        RecycleAuditReportEntity,
        {
          orderId: order.id,
          result:
            price >= order.estimatePrice
              ? AuditResult.APPROVED
              : AuditResult.PRICE_CHANGE,
          items: readAuditItems(payload.items),
          note: optionalString(payload.note) ?? null,
          internalNote: optionalString(payload.internalNote) ?? null,
          suggestedPrice: price,
          photos: readStringArray(payload.photos),
        },
        ['orderId'],
      );
      return;
    }
    if (action === 'reject_inspect') {
      await manager.upsert(
        RecycleAuditReportEntity,
        {
          orderId: order.id,
          result: AuditResult.REJECTED,
          items: [],
          note: optionalString(payload.note) ?? null,
          internalNote: null,
          suggestedPrice: null,
          photos: readStringArray(payload.photos),
        },
        ['orderId'],
      );
    }
  }

  private async writeEvent(
    manager: import('typeorm').EntityManager,
    order: RecycleOrderEntity,
    action: string,
    actor: Actor | null,
    from: OrderStatus | null,
    to: OrderStatus,
    title: string,
    note: string | null,
    payload: Record<string, unknown>,
  ) {
    await manager.save(
      RecycleOrderEventEntity,
      manager.create(RecycleOrderEventEntity, {
        orderId: order.id,
        bizCode: order.bizCode,
        action,
        fromStatus: from,
        toStatus: to,
        actorId: actor?.userId ?? null,
        actorRoles: actor?.roles ?? [],
        title,
        note,
        payload,
      }),
    );
  }

  private publishApprovalRequest(
    actor: Actor,
    bizCode: string,
    order: RecycleOrderEntity,
    type: ApprovalType,
    payload: Record<string, unknown>,
  ) {
    this.publish(
      MQTT_PATTERNS.RECYCLE_EVT_APPROVAL_REQUESTED,
      internalPayload({
        _bizCode: bizCode,
        orderId: order.id,
        type,
        requestedBy: actor.userId,
        payload: {
          estimatePrice: order.estimatePrice,
          bOfferPrice: order.bOfferPrice,
          negotiatePrice: order.negotiatePrice,
          requestedPrice: Number(payload.price ?? 0),
        },
      }),
    );
  }

  private publish(pattern: string, data: Record<string, unknown>) {
    this.bus.emit(pattern, data).subscribe({
      error: (err: unknown) =>
        this.logger.error(
          `内部事件发送失败 ${pattern}: ${err instanceof Error ? err.message : String(err)}`,
        ),
    });
  }
}
