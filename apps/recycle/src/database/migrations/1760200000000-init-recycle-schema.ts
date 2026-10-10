import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 回收业务初始 schema。
 *
 * 订单状态用数据库原生枚举 `recycle_order_status` 承载，
 * 应用层写入非法值会被数据库直接拒绝。
 *
 * ⚠️ 新增订单状态时需要单独一条迁移：
 *   ALTER TYPE recycle_order_status ADD VALUE 'xxx' AFTER 'yyy';
 * （PG 11+ 支持，但不能与同一事务内的使用该类型的语句混在一起）
 */
export class InitRecycleSchema1760200000000 implements MigrationInterface {
  name = 'InitRecycleSchema1760200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE recycle_order_status AS ENUM (
          'draft', 'quoted', 'submitted', 'inspecting', 'evaluated',
          'negotiating', 'accepted', 'paid', 'rejected', 'returned'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE recycle_audit_result AS ENUM ('approved', 'rejected', 'price_change');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE recycle_approval_type AS ENUM ('price_change', 'negotiation');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE recycle_approval_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS recycle_orders (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        code varchar(32) NOT NULL,
        biz_code varchar(64) NOT NULL,
        owner_id uuid NOT NULL,
        owner_openid varchar(64),
        assigned_agent_id uuid,
        region_code varchar(32),
        status recycle_order_status NOT NULL DEFAULT 'draft',
        version int NOT NULL DEFAULT 0,
        brand varchar(64) NOT NULL DEFAULT '',
        model varchar(64) NOT NULL DEFAULT '',
        spec varchar(128),
        cartridge_type varchar(16),
        total_quantity int NOT NULL DEFAULT 0,
        estimate_price int NOT NULL DEFAULT 0,
        b_offer_price int,
        negotiate_price int,
        final_price int,
        b_eval_note text,
        internal_note text,
        screenshots jsonb NOT NULL DEFAULT '[]'::jsonb,
        logistics_no varchar(64) NOT NULL DEFAULT '',
        logistics_company varchar(64),
        return_logistics_no varchar(64),
        transfer_bill_no varchar(64),
        paid_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_recycle_orders_code ON recycle_orders (code)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_recycle_orders_biz_status ON recycle_orders (biz_code, status)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_recycle_orders_biz_owner ON recycle_orders (biz_code, owner_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_recycle_orders_status ON recycle_orders (status)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_recycle_orders_created_at ON recycle_orders (created_at)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS recycle_order_items (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id uuid NOT NULL REFERENCES recycle_orders(id) ON DELETE CASCADE,
        cartridge_type varchar(16) NOT NULL,
        brand varchar(64) NOT NULL,
        model varchar(64) NOT NULL,
        spec varchar(128),
        chip boolean NOT NULL DEFAULT false,
        quantity int NOT NULL DEFAULT 1,
        price int NOT NULL DEFAULT 0,
        sort int NOT NULL DEFAULT 0
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_recycle_order_items_order ON recycle_order_items (order_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS recycle_order_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id uuid NOT NULL REFERENCES recycle_orders(id) ON DELETE CASCADE,
        biz_code varchar(64) NOT NULL,
        action varchar(32) NOT NULL,
        from_status recycle_order_status,
        to_status recycle_order_status NOT NULL,
        actor_id uuid,
        actor_roles jsonb NOT NULL DEFAULT '[]'::jsonb,
        title varchar(200),
        note text,
        payload jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_recycle_order_events_order ON recycle_order_events (order_id, created_at)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS recycle_audit_reports (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id uuid NOT NULL REFERENCES recycle_orders(id) ON DELETE CASCADE,
        result recycle_audit_result NOT NULL,
        items jsonb NOT NULL DEFAULT '[]'::jsonb,
        note text,
        internal_note text,
        suggested_price int,
        photos jsonb NOT NULL DEFAULT '[]'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_recycle_audit_reports_order ON recycle_audit_reports (order_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS recycle_approval_tasks (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        biz_code varchar(64) NOT NULL,
        order_id uuid NOT NULL,
        type recycle_approval_type NOT NULL,
        status recycle_approval_status NOT NULL DEFAULT 'pending',
        assignee_role varchar(32) NOT NULL,
        assignee_id uuid,
        requested_by uuid NOT NULL,
        payload jsonb NOT NULL DEFAULT '{}'::jsonb,
        decided_by uuid,
        decided_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_recycle_approval_tasks_biz_status ON recycle_approval_tasks (biz_code, status)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_recycle_approval_tasks_order ON recycle_approval_tasks (order_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_recycle_approval_tasks_assignee ON recycle_approval_tasks (assignee_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS recycle_approval_records (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id uuid NOT NULL REFERENCES recycle_approval_tasks(id) ON DELETE CASCADE,
        order_id uuid NOT NULL,
        actor_id uuid NOT NULL,
        actor_roles jsonb NOT NULL DEFAULT '[]'::jsonb,
        decision varchar(16) NOT NULL,
        price int,
        reason text,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_recycle_approval_records_task ON recycle_approval_records (task_id, created_at)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_recycle_approval_records_order ON recycle_approval_records (order_id)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS recycle_approval_records`);
    await queryRunner.query(`DROP TABLE IF EXISTS recycle_approval_tasks`);
    await queryRunner.query(`DROP TABLE IF EXISTS recycle_audit_reports`);
    await queryRunner.query(`DROP TABLE IF EXISTS recycle_order_events`);
    await queryRunner.query(`DROP TABLE IF EXISTS recycle_order_items`);
    await queryRunner.query(`DROP TABLE IF EXISTS recycle_orders`);
    await queryRunner.query(`DROP TYPE IF EXISTS recycle_approval_status`);
    await queryRunner.query(`DROP TYPE IF EXISTS recycle_approval_type`);
    await queryRunner.query(`DROP TYPE IF EXISTS recycle_audit_result`);
    await queryRunner.query(`DROP TYPE IF EXISTS recycle_order_status`);
  }
}
