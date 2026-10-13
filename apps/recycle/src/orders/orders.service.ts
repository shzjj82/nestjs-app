import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import {
  MQTT_PATTERNS,
  optionalString,
  requiredString,
  RECYCLE_CLIENT,
  rpcFail,
  unwrapData,
  wechatPayMerchantConfig,
  WECHAT_CLIENT,
} from '@app/common';
import { catchError, lastValueFrom, of } from 'rxjs';
import { timeout } from 'rxjs/operators';
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
  resolveOrderViewForAction,
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
  transfer: '已发起收款，待微信确认',
  sync_transfer: '回收款已到账',
  return: '退货已完成',
  decide: '审批已决策',
};

/**
 * 动作 → 订阅消息场景。
 * 只通知「用户需要被动知晓」的节点；用户自己点的动作（quote / submit / negotiate）不发。
 * PAID 在用户确认收款成功（sync_transfer）后再发。
 */
const NOTICE_SCENES: Partial<Record<OrderAction, string>> = {
  evaluate: 'PRICE_OFFERED',
  decide: 'NEGOTIATE_RESULT',
  sync_transfer: 'PAID',
  return: 'RETURN',
};

interface WxTransferResult {
  mchId: string;
  appId: string;
  outBillNo: string;
  transferBillNo: string | null;
  state: string;
  packageInfo: string | null;
  failReason: string | null;
}

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
  '_wxTransfer',
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
 * 商户转账单号 out_bill_no：仅数字字母，≤32。
 * 客户端传的 billNo 不采信。
 */
function genOutBillNo(): string {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');
  return `TB${stamp}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
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
   * 微信商家转账在事务外调用，避免长事务锁单。
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

    const order = await this.orders.findOne({ where: { id, bizCode } });
    if (!order) {
      rpcFail(404, '订单不存在');
    }
    const view: OrderView = options.internal
      ? 'staff'
      : resolveOrderViewForAction(
          actor,
          bizCode,
          order,
          action,
          payload.view,
        );
    if (!canAccessOrder(actor, bizCode, order, view)) {
      rpcFail(404, '订单不存在');
    }

    const lens = actorForOrderView(actor, view);
    const authorized = this.policy.authorize(
      action,
      {
        actor: lens,
        order: toOrderSnapshot(order),
        payload,
      },
      options,
    );

    // 微信商家转账在事务外调用，避免长事务锁单
    let workPayload = payload;
    let targetStatus = authorized.to;
    let noticeAction = authorized.action;
    if (authorized.action === 'transfer') {
      // 历史单可能因网关未透传 openid 而缺字段；本人微信会话下可回填
      await this.ensureOwnerWechatIdentity(order, actor);
      const wx = await this.claimWxTransfer(order);
      workPayload = { ...payload, _wxTransfer: wx };
      if (wx.state === 'SUCCESS') {
        targetStatus = OrderStatus.PAID;
        noticeAction = 'sync_transfer';
      }
      // 已有待确认单且未改库字段时，直接返回（避免无意义 bump version）
      if (
        order.status === OrderStatus.PAYING &&
        wx.outBillNo === order.transferBillNo &&
        wx.packageInfo === order.transferPackageInfo &&
        wx.state !== 'SUCCESS'
      ) {
        return this.toView(order, actor, view);
      }
    } else if (authorized.action === 'sync_transfer') {
      const wx = await this.queryWxTransfer(order);
      if (wx.state !== 'SUCCESS') {
        await this.orders.update(
          { id: order.id, version: order.version },
          {
            transferState: wx.state,
            transferPackageInfo: wx.packageInfo ?? order.transferPackageInfo,
            transferWxBillNo: wx.transferBillNo ?? order.transferWxBillNo,
            version: order.version + 1,
          },
        );
        const latest = await this.orders.findOneOrFail({
          where: { id: order.id },
        });
        if (wx.state === 'FAIL' || wx.state === 'CANCELLED') {
          rpcFail(
            409,
            `微信转账未成功（${wx.state}${wx.failReason ? `: ${wx.failReason}` : ''}），请重新发起收款`,
          );
        }
        return this.toView(latest, actor, view);
      }
      workPayload = { ...payload, _wxTransfer: wx };
    }

    return this.dataSource.transaction(async (manager) => {
      const locked = await manager.findOne(RecycleOrderEntity, {
        where: { id, bizCode },
      });
      if (!locked) {
        rpcFail(404, '订单不存在');
      }
      if (
        locked.version !== order.version &&
        (authorized.action === 'transfer' ||
          authorized.action === 'sync_transfer')
      ) {
        rpcFail(409, '订单已被其他人更新，请刷新后重试');
      }

      const patch = this.buildPatch(
        authorized.action,
        locked,
        workPayload,
        lens,
      );

      const result = await manager
        .createQueryBuilder()
        .update(RecycleOrderEntity)
        .set({
          ...patch,
          status: targetStatus,
          version: locked.version + 1,
          updatedAt: () => 'CURRENT_TIMESTAMP',
        })
        .where('id = :id', { id: locked.id })
        .andWhere('version = :version', { version: locked.version })
        .execute();
      if (!result.affected) {
        rpcFail(409, '订单已被其他人更新，请刷新后重试');
      }

      const saved = await manager.findOneOrFail(RecycleOrderEntity, {
        where: { id: locked.id },
      });
      await this.persistSideEffects(
        manager,
        saved,
        authorized.action,
        workPayload,
      );
      await this.writeEvent(
        manager,
        saved,
        authorized.action,
        actor,
        authorized.from,
        targetStatus,
        actionTitle(authorized.action, workPayload),
        optionalString(workPayload.note) ??
          optionalString(workPayload.reason) ??
          null,
        sanitizePayload(workPayload),
      );

      if (authorized.approval) {
        this.publishApprovalRequest(
          actor,
          bizCode,
          saved,
          authorized.approval,
          workPayload,
        );
      }

      this.publishNotice(saved, noticeAction);

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

  /**
   * 订单本人拉取确认收款参数。
   * 若仍为 WAIT_USER_CONFIRM，会顺带查微信刷新 package。
   */
  async merchantTransfer(actor: Actor, bizCode: string, id: string) {
    const order = await this.loadVisible(actor, bizCode, id);
    if (actor.userId !== order.ownerId) {
      rpcFail(404, '订单不存在');
    }
    if (order.status !== OrderStatus.PAYING) {
      rpcFail(409, '订单当前不在待确认收款状态');
    }
    if (!order.transferPackageInfo || !order.transferBillNo) {
      rpcFail(409, '尚未发起微信转账或 package 已失效');
    }
    const mchId = wechatPayMerchantConfig()?.mchId;
    if (!mchId || !order.wechatAppId) {
      rpcFail(503, '未配置微信支付商户或订单缺少 appId');
    }

    // 查单刷新：仍待确认则沿用/更新 package；已成功则提示走 sync
    try {
      const wx = await this.queryWxTransfer(order);
      if (wx.state === 'SUCCESS') {
        rpcFail(409, '转账已到账，请调用 sync_transfer 完结订单');
      }
      if (wx.state === 'FAIL' || wx.state === 'CANCELLED') {
        rpcFail(
          409,
          `微信转账已失败（${wx.state}），请重新发起收款`,
        );
      }
      if (wx.packageInfo && wx.packageInfo !== order.transferPackageInfo) {
        await this.orders.update(
          { id: order.id },
          {
            transferPackageInfo: wx.packageInfo,
            transferState: wx.state,
            transferWxBillNo: wx.transferBillNo ?? order.transferWxBillNo,
          },
        );
        return {
          mchId,
          appId: order.wechatAppId,
          package: wx.packageInfo,
          outBillNo: order.transferBillNo,
          state: wx.state,
        };
      }
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 409 || status === 503) {
        throw err;
      }
      this.logger.warn(
        `刷新转账 package 失败，返回缓存：${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    return {
      mchId,
      appId: order.wechatAppId,
      package: order.transferPackageInfo,
      outBillNo: order.transferBillNo,
      state: order.transferState,
    };
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
      { mchId: wechatPayMerchantConfig()?.mchId ?? null },
    );
  }

  /**
   * 确保订单上有收款用的 openid / appId。
   * 只允许订单本人用当前微信会话回填（网关曾漏传 openid 的历史单）。
   */
  private async ensureOwnerWechatIdentity(
    order: RecycleOrderEntity,
    actor: Actor,
  ): Promise<void> {
    if (order.ownerOpenid && order.wechatAppId) {
      return;
    }
    if (actor.userId !== order.ownerId) {
      rpcFail(409, '订单缺少收款 openid（非小程序下单无法商家转账）');
    }
    if (!actor.openid || !actor.wechatAppId) {
      rpcFail(
        409,
        '当前登录会话没有微信 openid，请用微信小程序重新登录后再收款',
      );
    }
    await this.orders.update(
      { id: order.id },
      { ownerOpenid: actor.openid, wechatAppId: actor.wechatAppId },
    );
    order.ownerOpenid = actor.openid;
    order.wechatAppId = actor.wechatAppId;
  }

  /**
   * 客户发起收款：向微信创建商家转账单，拿 package_info。
   * 已有未完成单据则查单复用，避免重复转账。
   */
  private async claimWxTransfer(
    order: RecycleOrderEntity,
  ): Promise<WxTransferResult> {
    if (!order.ownerOpenid || !order.wechatAppId) {
      rpcFail(409, '订单缺少收款 openid（非小程序下单无法商家转账）');
    }
    // 本地先拦一层：避免 wechat 未配商户时只冒出英文 Internal server error
    if (!wechatPayMerchantConfig()) {
      rpcFail(
        503,
        '未配置微信支付商户（WECHAT_PAY_MCH_ID / SERIAL_NO / PRIVATE_KEY / TRANSFER_SCENE_ID）',
      );
    }
    const amount = Number(order.finalPrice);
    if (!Number.isInteger(amount) || amount <= 0) {
      rpcFail(409, '成交价无效，无法发起收款');
    }

    if (order.transferBillNo) {
      try {
        const existing = await this.queryWxTransfer(order);
        if (
          existing.state === 'WAIT_USER_CONFIRM' ||
          existing.state === 'TRANSFERING' ||
          existing.state === 'SUCCESS'
        ) {
          return {
            ...existing,
            packageInfo: existing.packageInfo ?? order.transferPackageInfo,
            outBillNo: existing.outBillNo || order.transferBillNo,
          };
        }
        // FAIL / CANCELLED → 换新单号重开
      } catch (err) {
        this.logger.warn(
          `查原转账单失败，将重新发起：${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    const outBillNo = genOutBillNo();
    try {
      const raw = await lastValueFrom(
        this.wechat
          .send(MQTT_PATTERNS.WECHAT_TRANSFER_CREATE, {
            appId: order.wechatAppId,
            openid: order.ownerOpenid,
            outBillNo,
            transferAmount: amount,
            transferRemark: `回收款 ${order.code}`,
          })
          .pipe(timeout(15000)),
      );
      const wx = unwrapData<WxTransferResult>(raw);
      if (!wx?.packageInfo && wx?.state === 'WAIT_USER_CONFIRM') {
        rpcFail(502, '微信未返回 package_info，无法拉起确认收款');
      }
      if (
        wx.state !== 'WAIT_USER_CONFIRM' &&
        wx.state !== 'TRANSFERING' &&
        wx.state !== 'SUCCESS'
      ) {
        rpcFail(
          502,
          `微信转账未进入待确认（${wx.state}${wx.failReason ? `: ${wx.failReason}` : ''}）`,
        );
      }
      return { ...wx, outBillNo: wx.outBillNo || outBillNo };
    } catch (err) {
      this.throwWxTransferError(err, '发起微信转账失败');
    }
  }

  private async queryWxTransfer(
    order: RecycleOrderEntity,
  ): Promise<WxTransferResult> {
    if (!order.transferBillNo || !order.wechatAppId) {
      rpcFail(409, '订单尚未发起微信转账');
    }
    try {
      const raw = await lastValueFrom(
        this.wechat
          .send(MQTT_PATTERNS.WECHAT_TRANSFER_QUERY, {
            appId: order.wechatAppId,
            outBillNo: order.transferBillNo,
          })
          .pipe(timeout(12000)),
      );
      return unwrapData<WxTransferResult>(raw);
    } catch (err) {
      this.throwWxTransferError(err, '查询微信转账失败');
    }
  }

  /** 把 MQTT / Nest 各种错误形态收成可读 rpcFail */
  private throwWxTransferError(err: unknown, fallback: string): never {
    if (err && typeof err === 'object') {
      const rec = err as {
        status?: number | string;
        message?: unknown;
        error?: { status?: number; message?: unknown };
      };
      const nested = rec.error;
      if (typeof nested?.status === 'number' && nested.message != null) {
        rpcFail(nested.status, String(nested.message));
      }
      if (typeof rec.status === 'number' && rec.status >= 400 && rec.message) {
        rpcFail(rec.status, String(rec.message));
      }
      // Nest 有时把 RpcException payload 序列化进 message
      if (typeof rec.message === 'string') {
        try {
          const parsed = JSON.parse(rec.message) as {
            status?: number;
            message?: unknown;
          };
          if (typeof parsed.status === 'number' && parsed.message != null) {
            rpcFail(parsed.status, String(parsed.message));
          }
        } catch {
          /* not json */
        }
        if (rec.message !== 'Internal server error') {
          rpcFail(502, `${fallback}：${rec.message}`);
        }
      }
    }
    rpcFail(
      502,
      `${fallback}：${err instanceof Error ? err.message : String(err)}`,
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
      case 'transfer': {
        const wx = payload._wxTransfer as WxTransferResult | undefined;
        if (!wx) {
          rpcFail(500, '缺少微信转账结果');
        }
        return {
          transferBillNo: wx.outBillNo,
          transferWxBillNo: wx.transferBillNo,
          transferPackageInfo: wx.packageInfo,
          transferState: wx.state,
          paidAt: wx.state === 'SUCCESS' ? new Date() : null,
        };
      }
      case 'sync_transfer': {
        const wx = payload._wxTransfer as WxTransferResult | undefined;
        return {
          transferState: wx?.state ?? 'SUCCESS',
          transferWxBillNo: wx?.transferBillNo ?? order.transferWxBillNo,
          transferPackageInfo: null,
          paidAt: new Date(),
        };
      }
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
