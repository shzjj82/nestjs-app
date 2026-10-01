import {
  isTreeView,
  parseVisibility,
  resolveDocsListScope,
} from '../../src/documents/list-scope';

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

});

describe('isTreeView', () => {
  it('detects tree and view=tree', () => {
    expect(isTreeView({ tree: '1' })).toBe(true);
    expect(isTreeView({ view: 'tree' })).toBe(true);
    expect(isTreeView({})).toBe(false);
  });
});

describe('parseVisibility', () => {
  it('parses visibility', () => {
    expect(parseVisibility('public')).toBe('public');
    expect(parseVisibility('private')).toBe('private');
    expect(parseVisibility(false)).toBe('private');
    expect(parseVisibility(undefined)).toBe('private');
  });
});
