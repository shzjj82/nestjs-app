import { asPageIds } from './todo-page-ids';

describe('asPageIds', () => {
  it('accepts uuid list and drops junk', () => {
    expect(
      asPageIds([
        'a20573a8-97f6-41c3-ad3a-651df103b852',
        'not-a-uuid',
        'a20573a8-97f6-41c3-ad3a-651df103b852',
        '  ',
      ]),
    ).toEqual(['a20573a8-97f6-41c3-ad3a-651df103b852']);
  });

  it('accepts a single pageId string', () => {
    expect(asPageIds('a20573a8-97f6-41c3-ad3a-651df103b852')).toEqual([
      'a20573a8-97f6-41c3-ad3a-651df103b852',
    ]);
  });
});
