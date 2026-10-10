import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 单个场景的订阅消息配置。
 *
 * 微信订阅消息的 `data` 字段名（thing1 / character_string2 / amount3 …）
 * 是**模板申请下来才确定**的，业务服务不可能知道。
 * 所以这里配一份「模板字段 → 业务语义字段」的映射，
 * 业务服务只上报语义值（orderCode / title / amount …），由本服务填进模板。
 */
export interface SubscribeTemplateConfig {
  templateId: string;
  /** 模板字段名 → 语义字段名；省略时回落到默认填充 */
  fields?: Record<string, string>;
}

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
