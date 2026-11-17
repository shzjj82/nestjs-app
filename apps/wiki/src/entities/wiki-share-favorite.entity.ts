import { CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * 登录用户收藏的分享。只记录账号和 token，不保存 JWT，也不复制正文。
 */
@Entity('wiki_share_favorites')
@Index('idx_wiki_share_favorites_account', ['accountId', 'createdAt'])
export class WikiShareFavoriteEntity {
  @PrimaryColumn({ name: 'account_id', type: 'uuid' })
  accountId!: string;

  @PrimaryColumn({ type: 'varchar', length: 64 })
  token!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
