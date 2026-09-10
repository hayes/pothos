import type { TableRelationalConfig } from 'drizzle-orm';
import { drizzleAdapter } from '../src/utils/adapter';
import type { PothosDrizzleSchemaConfig } from '../src/utils/config';
import { omitUndefinedKeys } from '../src/utils/selections';

const fakeTable = { name: 'users', relations: {} } as unknown as TableRelationalConfig;
const fakeConfig = {
  getPrimaryKey: () => [],
  columnToTsName: () => '',
  skipDeferredFragments: true,
  relations: {},
} as unknown as PothosDrizzleSchemaConfig;
const adapter = drizzleAdapter(fakeConfig);

describe('selections', () => {
  it('omits undefined properties without mutating the source query', () => {
    const query = { where: undefined, orderBy: undefined, limit: 1 };

    const normalized = omitUndefinedKeys(query);

    expect(normalized).toEqual({ limit: 1 });
    expect(normalized).not.toBe(query);
    expect(query).toHaveProperty('where');
    expect(query).toHaveProperty('orderBy');
  });

  it('preserves queries that have no undefined properties', () => {
    const query = { where: { id: 1 }, limit: 1 };

    expect(omitUndefinedKeys(query)).toBe(query);
  });

  it.each([
    'where',
    'orderBy',
    'limit',
    'offset',
  ])('omits an undefined %s from merged selections', (key) => {
    const node = adapter.createNode(fakeTable);

    adapter.mergeQuery(node, { [key]: undefined });

    expect(adapter.toQuery(node)).not.toHaveProperty(key);
  });

  it('treats an undefined property as equivalent to an absent one when merging', () => {
    const withUndefined = adapter.createNode(fakeTable);
    adapter.mergeQuery(withUndefined, { orderBy: undefined, where: undefined });

    const withoutKeys = adapter.createNode(fakeTable);
    adapter.mergeQuery(withoutKeys, {});

    expect(adapter.canMergeQuery(withUndefined, {})).toBe(true);
    expect(adapter.canMergeQuery(withUndefined, adapter.toQuery(withoutKeys))).toBe(true);
  });

  it('ignores columns set to false instead of adding them to the selection', () => {
    const node = adapter.createNode(fakeTable);

    adapter.mergeQuery(node, {
      columns: {
        firstName: true,
        passwordHash: false,
      },
    });

    expect(node.columns).toEqual(new Set(['firstName']));
    expect(adapter.toQuery(node)).toEqual({
      columns: { firstName: true },
      with: {},
      extras: {},
    });
  });

  it('still allows a column to be added later if another field requests it', () => {
    const node = adapter.createNode(fakeTable);

    adapter.mergeQuery(node, {
      columns: {
        passwordHash: false,
      },
    });

    adapter.mergeQuery(node, {
      columns: {
        passwordHash: true,
      },
    });

    expect(node.columns).toEqual(new Set(['passwordHash']));
  });

  it('treats columns object with only falsy entries as an empty selection', () => {
    const node = adapter.createNode(fakeTable);

    adapter.mergeQuery(node, {
      columns: {
        passwordHash: false,
      },
    });

    expect(node.columns?.size).toBe(0);
  });
});
