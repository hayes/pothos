import type { TableRelationalConfig } from 'drizzle-orm';
import type { PothosDrizzleSchemaConfig } from '../src/utils/config';
import {
  createState,
  mergeSelection,
  omitUndefinedKeys,
  selectionCompatible,
  selectionToQuery,
  stateCompatible,
} from '../src/utils/selections';

const fakeTable = { name: 'users' } as unknown as TableRelationalConfig;
const fakeConfig = {
  getPrimaryKey: () => [],
  columnToTsName: () => '',
  skipDeferredFragments: true,
  relations: {},
} as unknown as PothosDrizzleSchemaConfig;

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
    const state = createState(fakeTable, true);

    mergeSelection(fakeConfig, state, { [key]: undefined });

    expect(selectionToQuery(fakeConfig, state)).not.toHaveProperty(key);
  });

  it('treats an undefined property as equivalent to an absent one when merging', () => {
    const withUndefined = createState(fakeTable, true);
    mergeSelection(fakeConfig, withUndefined, { orderBy: undefined, where: undefined });

    const withoutKeys = createState(fakeTable, true);
    mergeSelection(fakeConfig, withoutKeys, {});

    expect(selectionCompatible(withUndefined, {})).toBe(true);
    expect(stateCompatible(withUndefined, withoutKeys)).toBe(true);
  });

  it('ignores columns set to false instead of adding them to the selection', () => {
    const state = createState(fakeTable, true);

    mergeSelection(fakeConfig, state, {
      columns: {
        firstName: true,
        passwordHash: false,
      },
    });

    expect(state.columns).toEqual(new Set(['firstName']));
    expect(selectionToQuery(fakeConfig, state)).toEqual({
      columns: { firstName: true },
      with: {},
      extras: {},
    });
  });

  it('still allows a column to be added later if another field requests it', () => {
    const state = createState(fakeTable, true);

    mergeSelection(fakeConfig, state, {
      columns: {
        passwordHash: false,
      },
    });

    mergeSelection(fakeConfig, state, {
      columns: {
        passwordHash: true,
      },
    });

    expect(state.columns).toEqual(new Set(['passwordHash']));
  });

  it('treats columns object with only falsy entries as an empty selection', () => {
    const state = createState(fakeTable, true);

    mergeSelection(fakeConfig, state, {
      columns: {
        passwordHash: false,
      },
    });

    expect(state.columns.size).toBe(0);
    expect(state.allColumns).toBe(false);
  });
});
