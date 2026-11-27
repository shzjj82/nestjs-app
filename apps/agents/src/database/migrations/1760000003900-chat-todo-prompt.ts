import type { MigrationInterface, QueryRunner } from 'typeorm';

const BODY = `用户在问自己的待办。只根据下方「我的待办」回答，按状态、标题和截止日期说明。清单里没有的任务直接说没有。不要查知识库，不要用网上内容补充，也不要写「知识库里没有可回答」。`;

export class ChatTodoPrompt1760000003900 implements MigrationInterface {
  name = 'ChatTodoPrompt1760000003900';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO ag_prompts (code, body) VALUES ($1, $2) ON CONFLICT (code) DO NOTHING`,
      ['chat.todo', BODY],
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM ag_prompts WHERE code = $1`, ['chat.todo']);
  }
}
