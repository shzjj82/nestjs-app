import { Logger } from '@nestjs/common';
import type { DataSource, EntityManager } from 'typeorm';

const logger = new Logger('UsercenterLegacyAccounts');

async function tableExists(db: DataSource | EntityManager, table: string) {
  const rows: unknown[] = await db.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = $1`,
    [table],
  );
  return rows.length > 0;
}

/**
 * 旧版把登录名/密码放在 uc_users 上；synchronize 会删掉这两列，
 * 所以必须在同步之前先把它们拷到临时表。
 */
export async function captureLegacyPasswords(ds: DataSource) {
  const cols: unknown[] = await ds.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name = 'uc_users'
       AND column_name IN ('username', 'password_hash')`,
  );
  if (cols.length < 2) {
    return;
  }
  await ds.query(
    `CREATE TABLE IF NOT EXISTS uc_legacy_passwords (
       user_id uuid PRIMARY KEY,
       username varchar(64) NOT NULL,
       password_hash varchar(128) NOT NULL
     )`,
  );
  await ds.query(
    `INSERT INTO uc_legacy_passwords (user_id, username, password_hash)
     SELECT id, username, password_hash FROM uc_users
     WHERE username IS NOT NULL AND password_hash IS NOT NULL
     ON CONFLICT DO NOTHING`,
  );
}

/** 把旧的账密、小程序身份、用户角色迁到 uc_accounts / uc_account_roles，迁完即改名归档 */
export async function migrateLegacyAccounts(ds: DataSource) {
  if (!(await tableExists(ds, 'uc_accounts'))) {
    return;
  }
  await ds.transaction(async (m) => {
    const hasPasswords = await tableExists(m, 'uc_legacy_passwords');
    const hasIdentities = await tableExists(m, 'uc_identities');
    const hasUserRoles = await tableExists(m, 'uc_user_roles');
    if (!hasPasswords && !hasIdentities && !hasUserRoles) {
      return;
    }

    if (hasPasswords) {
      await m.query(
        `INSERT INTO uc_accounts (user_id, type, identifier, password_hash, status)
         SELECT l.user_id, 'password', l.username, l.password_hash, 1
         FROM uc_legacy_passwords l
         JOIN uc_users u ON u.id = l.user_id
         WHERE NOT EXISTS (
           SELECT 1 FROM uc_accounts a
           WHERE a.type = 'password' AND a.client_id IS NULL AND a.identifier = l.username
         )`,
      );
      await m.query(`DROP TABLE uc_legacy_passwords`);
    }

    if (hasIdentities) {
      await m.query(
        `INSERT INTO uc_accounts (user_id, type, identifier, unionid, client_id, status, created_at)
         SELECT i.user_id, i.provider, i.identifier, i.unionid, i.client_id, 1, i.created_at
         FROM uc_identities i
         WHERE NOT EXISTS (
           SELECT 1 FROM uc_accounts a
           WHERE a.type = i.provider AND a.client_id = i.client_id AND a.identifier = i.identifier
         )`,
      );
      await m.query(`ALTER TABLE uc_identities RENAME TO uc_identities_legacy`);
    }

    if (hasUserRoles) {
      await m.query(
        `INSERT INTO uc_account_roles (account_id, role_id)
         SELECT a.id, ur.role_id
         FROM uc_user_roles ur
         JOIN uc_accounts a ON a.user_id = ur.user_id
         ON CONFLICT DO NOTHING`,
      );
      await m.query(`ALTER TABLE uc_user_roles RENAME TO uc_user_roles_legacy`);
    }
    logger.log('旧版用户凭证与角色已迁移到账户表');
  });
}
