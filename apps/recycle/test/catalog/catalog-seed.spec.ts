import { RecycleCartridgeTypeEntity } from '../../src/entities';
import { seedCatalog } from '../../src/catalog/catalog-seed';

describe('seedCatalog', () => {
  it('does not upsert when types already exist', async () => {
    const types = {
      count: jest.fn().mockResolvedValue(2),
      upsert: jest.fn(),
    };
    const dataSource = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === RecycleCartridgeTypeEntity) {
          return types;
        }
        return { upsert: jest.fn(), find: jest.fn() };
      }),
    };
    await seedCatalog(dataSource as never);
    expect(types.upsert).not.toHaveBeenCalled();
  });
});
