import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

/**
 * 页面分享快照。正文在创建时冻结，之后原文修改不回写。
 * 不保存 JWT；公开接口只凭 token 读取。
 */
@Entity('wiki_shares')
@Index('idx_wiki_shares_app_page', ['appCode', 'pageId'])
@Index('idx_wiki_shares_parent', ['parentToken'])
@Index('idx_wiki_shares_owner', ['ownerAccountId'])
@Index('idx_wiki_shares_page_owner', ['pageOwnerAccountId'])
export class WikiShareEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  token!: string;

  @Column({ name: 'app_code', type: 'varchar', length: 64 })
  appCode!: string;

  @Column({ name: 'page_id', type: 'uuid' })
  pageId!: string;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'jsonb' })
  body!: Record<string, unknown>;

  /** 创建时的子孙页面。每层含 id、标题、正文和下一层，不并进父页面正文 */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  children!: unknown[];

  /** 发出根链接的账号；再分享原样复制 */
  @Column({ name: 'owner_account_id', type: 'uuid' })
  ownerAccountId!: string;

  /** 文档作者，可以撤销 */
  @Column({ name: 'page_owner_account_id', type: 'uuid', nullable: true })
  pageOwnerAccountId!: string | null;

  /** 这条记录的登录创建者；匿名再分享为空 */
  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  /** 分享时的显示名，公开页只给这个名字，不给账号 id */
  @Column({ name: 'shared_by', type: 'varchar', length: 80, nullable: true })
  sharedBy!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  /** 空表示不过期 */
  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @Column({ name: 'allow_reshare', type: 'boolean', default: false })
  allowReshare!: boolean;

  @Column({ name: 'parent_token', type: 'varchar', length: 64, nullable: true })
  parentToken!: string | null;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;
}
