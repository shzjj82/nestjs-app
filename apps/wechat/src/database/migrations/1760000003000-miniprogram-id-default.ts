import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 补上 wx_miniprograms.id 的默认值。
 *
 * 建表时写的是 `id uuid PRIMARY KEY`，没有 DEFAULT；而 TypeORM 的
 * `@PrimaryGeneratedColumn('uuid')` 在插入时发出的是 `DEFAULT`，
 * 于是每次登记小程序都撞 `null value in column "id"`（23502）——
 * 也就是说这个接口从建表起就没通过。这里对齐 recycle 服务的写法
 * （`id uuid PRIMARY KEY DEFAULT gen_random_uuid()`）。
 *
 * 不改 init 迁移而是新增一条：init 已在环境里应用过，改它不会生效，
 * 还会让「已迁移的环境」和「新装环境」产生分歧。
 */
export class MiniProgramIdDefault1760000003000 implements MigrationInterface {
  name = 'MiniProgramIdDefault1760000003000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE wx_miniprograms
        ALTER COLUMN id SET DEFAULT gen_random_uuid();
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE wx_miniprograms ALTER COLUMN id DROP DEFAULT;
    `);
  }
}
