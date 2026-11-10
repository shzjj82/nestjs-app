import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ChatConversations1760000003500 implements MigrationInterface {
  name = 'ChatConversations1760000003500';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ag_conversations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        biz_code varchar(64) NOT NULL,
        user_id varchar(64) NOT NULL,
        account_id uuid,
        title varchar(120) NOT NULL DEFAULT '新对话',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ag_conversations_biz_user_updated_idx
      ON ag_conversations (biz_code, user_id, updated_at DESC)
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ag_messages (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id uuid NOT NULL REFERENCES ag_conversations(id) ON DELETE CASCADE,
        role varchar(16) NOT NULL,
        content text NOT NULL,
        attachments jsonb,
        sources jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ag_messages_conversation_created_idx
      ON ag_messages (conversation_id, created_at)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS ag_messages`);
    await queryRunner.query(`DROP TABLE IF EXISTS ag_conversations`);
  }
}
