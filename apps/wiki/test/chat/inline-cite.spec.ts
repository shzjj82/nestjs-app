import { markWikiCitations } from '../../src/chat/inline-cite';

describe('markWikiCitations', () => {
  const page = { title: '准备条件', sourceType: 'editorjs' };
  const word = { title: '项目相关', sourceName: '项目相关.docx', sourceType: 'docx' };

  it('把带类型的书名号换成对应出处序号', () => {
    const reply = '资质见（《准备条件》，页面正文），费用见（《项目相关》，Word）。';
    expect(markWikiCitations(reply, [page, word])).toBe(
      '资质见{{cite:0}}，费用见{{cite:1}}。',
    );
  });

  it('单独的书名号和标题原文不换成引用', () => {
    expect(markWikiCitations('详见《项目相关》。', [word])).toBe('详见《项目相关》。');
    expect(markWikiCitations('任务进度还没开始。', [{ title: '任务进度', sourceType: 'editorjs' }])).toBe(
      '任务进度还没开始。',
    );
  });

  it('同一处优先吃掉整段括号，不重复标记', () => {
    expect(markWikiCitations('（《项目相关》，Word）', [word])).toBe('{{cite:0}}');
  });

  it('同一来源的标题和定位只标记一次', () => {
    const task = { title: '任务进度', sourceType: 'editorjs' };
    const reply =
      '根据参考资料（《任务进度》，页面）（类型：页面正文，定位：页面「任务进度」），未开始的任务如下：';
    expect(markWikiCitations(reply, [task])).toBe(
      '根据参考资料{{cite:0}}，未开始的任务如下：',
    );
    expect(
      markWikiCitations('根据参考资料（类型：页面正文，定位：页面「任务进度」），未开始的任务如下：', [task]),
    ).toBe('根据参考资料{{cite:0}}，未开始的任务如下：');
  });

  it('同一篇在两句出处里仍各标记一次', () => {
    const task = { title: '任务进度', sourceType: 'editorjs' };
    expect(
      markWikiCitations('见（出处：任务进度，页面）。另外（出处：任务进度，页面）里还有待办。', [task]),
    ).toBe('见{{cite:0}}。另外{{cite:0}}里还有待办。');
  });

  it('认模型实际写出的出处：标题，类型', () => {
    const reply = '基础准备条件（出处：准备条件，页面正文）\n合规（出处：项目相关，Word）';
    expect(markWikiCitations(reply, [page, word])).toBe(
      '基础准备条件{{cite:0}}\n合规{{cite:1}}',
    );
  });

  it('去掉类型写在书名前面的出处，只留引用标记', () => {
    expect(markWikiCitations('费用见出处：Word「《项目相关》」。', [word])).toBe(
      '费用见{{cite:0}}。',
    );
    expect(markWikiCitations('出处：页面正文「准备条件」', [page])).toBe('{{cite:0}}');
    expect(markWikiCitations('费用见（来源：《项目相关》）。', [word])).toBe('费用见（来源：《项目相关》）。');
  });

  it('英文出处也只留标记', () => {
    const project = { title: 'Project', sourceName: 'Project.docx', sourceType: 'docx' };
    expect(markWikiCitations('See (出处: Project, Word).', [project])).toBe('See {{cite:0}}.');
    expect(markWikiCitations('See 《Project》.', [project])).toBe('See 《Project》.');
  });

  it('对不上的正文保持原样', () => {
    expect(markWikiCitations('没有出处。', [page])).toBe('没有出处。');
  });
});
