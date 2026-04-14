import type { TableRelationalConfig } from 'drizzle-orm';
import type { PothosDrizzleSchemaConfig } from '../src/utils/config';
import { createState, mergeSelection, selectionToQuery } from '../src/utils/selections';

const fakeTable = { name: 'users' } as unknown as TableRelationalConfig;
const fakeConfig = {
  getPrimaryKey: () => [],
  columnToTsName: () => '',
  skipDeferredFragments: true,
  relations: {},
} as unknown as PothosDrizzleSchemaConfig;

describe('selections', () => {
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
