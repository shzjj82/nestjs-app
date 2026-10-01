import type { DataSource } from 'typeorm';
import { generateTeamCode } from '../teams/team-code';

async function tableExists(ds: DataSource, table: string) {
  const rows: unknown[] = await ds.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = current_schema() AND table_name = $1`,
    [table],
  );
  return rows.length > 0;
}

/**
 * 同步表结构之前补上团队码。已有行不能直接加非空列。
 */
export async function backfillTeamCodes(ds: DataSource) {
  if (!(await tableExists(ds, 'uc_teams'))) {
    return;
  }
  const columns: unknown[] = await ds.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name = 'uc_teams' AND column_name = 'code'`,
  );
  if (columns.length === 0) {
    await ds.query(`ALTER TABLE uc_teams ADD COLUMN code varchar(16)`);
  }
  const missing: Array<{ id: string }> = await ds.query(
    `SELECT id FROM uc_teams WHERE code IS NULL OR btrim(code) = ''`,
  );
  for (const row of missing) {
    let code = generateTeamCode();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const clash: unknown[] = await ds.query(
        `SELECT 1 FROM uc_teams WHERE code = $1 AND id <> $2`,
        [code, row.id],
      );
      if (clash.length === 0) {
        break;
      }
      code = generateTeamCode();
    }
    await ds.query(`UPDATE uc_teams SET code = $1 WHERE id = $2`, [code, row.id]);
  }
}
