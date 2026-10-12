import { readQuoteItems } from '../../src/catalog/catalog-items';

describe('catalog items', () => {
  it('requires modelId', () => {
    expect(() =>
      readQuoteItems([{ brand: '惠普 HP', model: 'HP 803', quantity: 1 }]),
    ).toThrow(/modelId/);
  });

  it('accepts modelId with quantity', () => {
    expect(
      readQuoteItems([
        {
          typeId: '11111111-1111-4111-8111-111111111111',
          brandId: '22222222-2222-4222-8222-222222222222',
          modelId: '33333333-3333-4333-8333-333333333333',
          quantity: 2,
        },
      ]),
    ).toEqual([
      {
        modelId: '33333333-3333-4333-8333-333333333333',
        typeId: '11111111-1111-4111-8111-111111111111',
        brandId: '22222222-2222-4222-8222-222222222222',
        quantity: 2,
      },
    ]);
  });
});
