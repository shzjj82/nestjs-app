import {
  isTreeView,
  parseVisibility,
  resolveDocsListScope,
} from './list-scope';

describe('resolveDocsListScope', () => {
  it('defaults to public', () => {
    expect(resolveDocsListScope({})).toBe('public');
  });

  it('accepts explicit scope', () => {
    expect(resolveDocsListScope({ scope: 'public' })).toBe('public');
    expect(resolveDocsListScope({ scope: 'feed' })).toBe('feed');
    expect(resolveDocsListScope({ scope: 'mine' })).toBe('mine');
    expect(resolveDocsListScope({ scope: 'all' })).toBe('all');
  });

  it('maps tree=1 to mine for backward compatibility', () => {
    expect(resolveDocsListScope({ tree: '1' })).toBe('mine');
  });

  it('explicit scope wins over tree', () => {
    expect(resolveDocsListScope({ scope: 'feed', tree: '1' })).toBe('feed');
  });
});

describe('isTreeView', () => {
  it('detects tree and view=tree', () => {
    expect(isTreeView({ tree: '1' })).toBe(true);
    expect(isTreeView({ view: 'tree' })).toBe(true);
    expect(isTreeView({})).toBe(false);
  });
});

describe('parseVisibility', () => {
  it('parses visibility and legacy draft', () => {
    expect(parseVisibility('public')).toBe('public');
    expect(parseVisibility('private')).toBe('private');
    expect(parseVisibility(false)).toBe('public');
    expect(parseVisibility(true)).toBe('private');
    expect(parseVisibility(undefined)).toBe('private');
  });
});
