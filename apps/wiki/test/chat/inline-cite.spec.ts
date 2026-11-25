import { markWikiCitations } from '../../src/chat/inline-cite';

describe('markWikiCitations', () => {
  const page = { title: '准备条件', sourceType: 'editorjs' };
  const word = { title: '项目相关', sourceName: '项目相关.docx', sourceType: 'docx' };

  it('把带类型的书名号换成对应出处序号', () => {
    const reply = '资质见（《准备条件》，页面正文），费用见（《项目相关》，Word）。';
    expect(markWikiCitations(reply, [page, word])).toBe('资质见{{cite:0}}，费用见{{cite:1}}。');
  });

  it('没有类型括号时也认书名号，文件名去掉后缀也能对上', () => {
    expect(markWikiCitations('详见《项目相关》。', [word])).toBe('详见{{cite:0}}。');
  });

  it('同一处优先吃掉整段括号，不重复标记', () => {
    expect(markWikiCitations('（《项目相关》，Word）', [word])).toBe('{{cite:0}}');
  });

  it('认模型实际写出的出处：标题，类型', () => {
    const reply = '基础准备条件（出处：准备条件，页面正文）\n合规（出处：项目相关，Word）';
    expect(markWikiCitations(reply, [page, word])).toBe('基础准备条件{{cite:0}}\n合规{{cite:1}}');
  });

  it('对不上的正文保持原样', () => {
    expect(markWikiCitations('没有出处。', [page])).toBe('没有出处。');
  });
});
