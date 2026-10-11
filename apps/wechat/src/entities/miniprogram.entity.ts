import type { WechatSubscribeTemplate } from '@app/common';
import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 单个场景的订阅消息配置。
 *
 * 类型定义在 `@app/common`：网关下发给小程序、admin 编辑，
 * 三处必须共用同一份契约，否则字段名对不上时静默发空。
 */
export type SubscribeTemplateConfig = WechatSubscribeTemplate;

@Entity('wx_miniprograms')
export class MiniProgramEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  code: string;

  @Column({ type: 'varchar', length: 64 })
  name: string;

  @Index({ unique: true })
  @Column({ name: 'app_id', type: 'varchar', length: 64 })
  appId: string;

  @Column({ type: 'varchar', length: 128 })
  secret: string;

  @Column({ type: 'smallint', default: 1 })
  status: number;

  /**
   * 订阅消息配置，按业务场景分组：
   * `{ "PRICE_OFFERED": { "templateId": "xxx", "fields": { "thing1": "orderCode" } } }`
   *
   * 模板必须先在小程序的「订阅消息」里申请，把模板 ID 与字段映射填到这里；
   * 下发与发送都读这份配置 —— 客户端绝不自己编模板 ID。
   *
   * ⚠️ 这里同时承载了「业务场景」（键）与「小程序资产」（template_id），是有意的合并：
   * 本表 `code` 就是业务 code，业务与小程序 1:1，所以挂在这里既表达了业务归属，
   * 又满足 template_id 只在该 appId 下有效；更关键的是发送发生在 wechat 服务内，
   * 键为 (appId, scene) 时查询零跨服务。若将来出现「一业务多小程序」或
   * 「一小程序多业务」，需把键扩展成 (businessCode, appId, scene) 并迁移。
   */
  @Column({
    name: 'subscribe_templates',
    type: 'jsonb',
    default: () => "'{}'::jsonb",
  })
  subscribeTemplates: Record<string, SubscribeTemplateConfig>;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt: Date;
}
