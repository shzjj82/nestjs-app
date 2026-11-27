import { chunkText } from '../../src/modules/rag/text/chunk';
import { labeledSheet } from '../../src/modules/rag/text/attachment-text';
import { applyMerges, parseDelimitedTable } from '../../src/modules/rag/text/table-text';

describe('labeledSheet', () => {
  it('keeps an empty cell in its own column', () => {
    const text = labeledSheet('名单', [
      ['姓名', '部门', '备注'],
      ['张三', '', '在职'],
    ]);
    expect(text).toBe('【表：名单】\n姓名：张三；部门：；备注：在职');
  });

  it('uses a single title row as the table name, not as column headers', () => {
    const text = labeledSheet('报表', [
      ['2024年销售'],
      ['姓名', '金额'],
      ['张三', '10'],
    ]);
    expect(text).toBe('【表：报表 · 2024年销售】\n姓名：张三；金额：10');
  });

  it('reads quoted csv cells without shifting later columns', () => {
    const rows = parseDelimitedTable('姓名,备注\n张三,"负责A,B"');
    expect(labeledSheet('通讯录', rows)).toBe('【表：通讯录】\n姓名：张三；备注：负责A,B');
  });
});

describe('applyMerges', () => {
  it('copies a merged value into the covered cells', () => {
    const rows = new Map<number, string[]>([
      [1, ['组别', '姓名']],
      [2, ['', '张三']],
    ]);
    expect(applyMerges(rows, ['A2:A2'])).toEqual([
      ['组别', '姓名'],
      ['', '张三'],
    ]);
    const merged = new Map<number, string[]>([
      [1, ['一组', '张三']],
      [2, ['', '李四']],
    ]);
    expect(applyMerges(merged, ['A1:A2'])).toEqual([
      ['一组', '张三'],
      ['一组', '李四'],
    ]);
  });
});

describe('chunkText tables', () => {
  it('keeps a role table out of the preceding paragraph', () => {
    const prose = '产品目标'.repeat(80);
    const table = '【表格】\n角色：超级管理员；主要职责：系统配置；核心权限：全部权限';
    const chunks = chunkText(`${prose}\n${table}\n3.1 权限原则`, { size: 200, overlap: 0 });
    const role = chunks.find((chunk) => chunk.includes('超级管理员'));
    expect(role).toContain('【表格】');
    expect(role).not.toContain('产品目标');
    expect(role).not.toContain('权限原则');
  });

  it('keeps a table row together and repeats the table name', () => {
    const row = `姓名：张三；部门：研发；城市：上海；备注：${'注'.repeat(80)}`;
    const text = `【表：名单】\n${row}`;
    const chunks = chunkText(text, { size: 80, overlap: 0 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk).toContain('【表：名单】');
      expect(chunk).toContain('姓名：张三');
    }
  });
});
