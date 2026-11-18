import type { MigrationInterface, QueryRunner } from 'typeorm';

/** 已建库的团队表主键没有默认值。TypeORM 插入 uuid 时写 DEFAULT，缺默认值会把 id 写成 null。 */
export class WikiTeamIdDefault1760000008000 implements MigrationInterface {
  name = 'WikiTeamIdDefault1760000008000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE wiki_teams
      ALTER COLUMN id SET DEFAULT gen_random_uuid()
    `);
    await queryRunner.query(`
      ALTER TABLE wiki_team_members
      ALTER COLUMN id SET DEFAULT gen_random_uuid()
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE wiki_team_members
      ALTER COLUMN id DROP DEFAULT
    `);
    await queryRunner.query(`
      ALTER TABLE wiki_teams
      ALTER COLUMN id DROP DEFAULT
    `);
  }
}
