import {
  wikiRemindClaimSql,
  wikiRemindListSql,
} from '../../src/todos/wiki-remind-store';

describe('wiki overdue reminder', () => {
  it('selects open tasks past their end date that were not reminded today', () => {
    const sql = wikiRemindListSql('todo.overdue', 'midnight');
    expect(sql).toMatch(/status IN \('pending', 'in_progress', 'open'\)/);
    expect(sql).toMatch(/LEFT\(TRIM\(data->>'end'\), 10\)::date/);
    expect(sql).toMatch(/< \$1::date/);
    expect(sql).toMatch(/last_overdue_notice_on IS NULL OR last_overdue_notice_on <> \$1::date/);
    expect(sql).not.toMatch(/'done'|'cancelled'/);
  });

  it('claims one overdue notice per Shanghai day', () => {
    const sql = wikiRemindClaimSql('todo.overdue');
    expect(sql).toMatch(/SET last_overdue_notice_on = \$1::date/);
    expect(sql).toMatch(/last_overdue_notice_on IS NULL OR last_overdue_notice_on <> \$1::date/);
    expect(sql).toMatch(/status IN \('pending', 'in_progress', 'open'\)/);
  });
});
