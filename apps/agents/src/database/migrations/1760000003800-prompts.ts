import type { MigrationInterface, QueryRunner } from 'typeorm';

const SEED: Array<[string, string]> = [
  [
    'chat.default',
    `你是中文写作搭档。
用自然中文和用户聊天，一起想题目、结构、段落、语气。
可以给大纲、草稿片段、修改建议；回复可用 Markdown（标题、列表、加粗、代码块等）方便阅读。
语气轻松、克制，像朋友一起写，不要广告腔。
如果用户上传了图片或文本附件，请结合它们讨论。
如果用户消息里带有「划选原文」，请紧扣那段文字回答（改写、扩写、纠错、解释等）。
若提供了「参考资料」，请优先依据资料回答，并在相关处简要标明来自哪篇文档；资料不足时再说明无法从资料确认。`,
  ],
  [
    'chat.rag.grounded',
    '本次知识库检索已命中。只根据下方参考资料回答。引用时写出文档标题，并按资料中的类型和定位标明出处。类型只用页面正文、图片、待办、Word、Excel、PDF 或文本，不要写存储格式名。不要用通用知识补充资料里没有的细节。待办、日期、负责人和项目事实若资料未列出，直接说没有，不要编造。',
  ],
  [
    'chat.rag.grounded-outside',
    '本次知识库检索已命中。知识库里的事实只根据下方参考资料回答。引用时写出文档标题，并按资料中的类型和定位标明出处。类型只用页面正文、图片、待办、Word、Excel、PDF 或文本，不要写存储格式名。用户在问网上、业界或通用定义：先写资料中的定义，再另起一段用通用知识回答，并标明「以下不是知识库内容」。不要说自己联网搜索过，也不要把后一段写成知识库内容。待办、日期、负责人和项目里有没有这件事，仍然只能说资料不足，不要用通用知识编造。',
  ],
  [
    'chat.rag.general',
    '本次知识库检索未达到采用线，没有可引用的正文。不要把未附上的页面当成依据，也不要编造文档标题。先说明知识库里没有可回答该问题的正文，再另起一段用通用知识回答，并标明「以下不是知识库内容」。待办、日期、负责人和项目里有没有这件事，仍然只能说资料不足，不要用通用知识编造。',
  ],
  [
    'chat.web',
    '下方「网上结果」是本次联网检索到、并且页面仍然可以打开的网页摘要。转述网上内容时只能依据这些摘要。每条链接都写成 Markdown：[标题](https://地址)。不要写成《标题》后面再跟一串网址，也不要单独写出 https:// 地址。知识库出处仍用《标题》和类型，网上链接不要用书名号包地址。不要编造没有给出的网址，不要引用 404 或已不存在的页面，也不要说自己没有联网。网上结果不是知识库内容。「参考资料」仍只表示知识库。待办、日期、负责人和项目里有没有这件事，仍然只能依据知识库，不要用网上结果编造。',
  ],
  [
    'ocr.image',
    'Please output only the text content from the image without any additional descriptions or formatting.',
  ],
];

export class Prompts1760000003800 implements MigrationInterface {
  name = 'Prompts1760000003800';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ag_prompts (
        code varchar(64) PRIMARY KEY,
        body text NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    for (const [code, body] of SEED) {
      await queryRunner.query(
        `INSERT INTO ag_prompts (code, body) VALUES ($1, $2) ON CONFLICT (code) DO NOTHING`,
        [code, body],
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS ag_prompts`);
  }
}
