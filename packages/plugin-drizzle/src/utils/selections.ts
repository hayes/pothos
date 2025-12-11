import { PothosValidationError } from '@pothos/core';
import type { DBQueryConfig, TableRelationalConfig } from 'drizzle-orm';
import type { PothosDrizzleSchemaConfig } from './config';
import { deepEqual } from './deep-equal';
import type { LoaderMappings } from './loader-map';

export interface SelectionState {
  table: TableRelationalConfig;
  query: object;
  allColumns: boolean;
  columns: Set<string>;
  with: Map<string, SelectionState>;
  extras: Map<string, NonNullable<SelectionMap['extras']>[string]>;
  mappings: LoaderMappings;
  parent?: SelectionState;
  depth: number;
  skipDeferredFragments: boolean;
  aggregation?: boolean;
}

export type SelectionMap = DBQueryConfig<'one'>;

export function selectionCompatible(
  state: SelectionState,
  selectionMap: SelectionMap | boolean,
  ignoreQuery = false,
): boolean {
  if (typeof selectionMap === 'boolean') {
    return ignoreQuery || !selectionMap || Object.keys(state.query).length === 0;
  }

  const { with: withSelection, extras, columns: _, ...query } = selectionMap;

  if (
    withSelection &&
    Object.entries(withSelection).some(
      ([key, value]) =>
        value &&
        state.with.has(key) &&
        // TODO: make sure nested extras are normalized
        !selectionCompatible(state.with.get(key)!, value as SelectionMap),
    )
  ) {
    return false;
  }

  if (
    extras &&
    Object.entries(extras).some(([key, value]) => {
      const existing = state.extras.get(key);
      return existing && existing !== value;
    })
  ) {
    return false;
  }

  return ignoreQuery || deepEqual(state.query, query);
}

export function stateCompatible(
  state: SelectionState,
  newState: SelectionState,
  ignoreQuery = false,
): boolean {
  for (const [name, relationState] of newState.with) {
    if (state.with.has(name) && !stateCompatible(state.with.get(name)!, relationState)) {
      return false;
    }
  }

  return ignoreQuery || deepEqual(state.query, newState.query);
}

export function mergeState(state: SelectionState, newState: SelectionState) {
  for (const [name, relationState] of newState.with) {
    if (state.with.has(name)) {
      mergeState(state.with.get(name)!, relationState);
    }
  }

  if (!state.allColumns) {
    if (newState.allColumns) {
      state.allColumns = true;
    } else {
      for (const name of newState.columns) {
        state.columns.add(name);
      }
    }
  }

  for (const [name, value] of newState.extras) {
    state.extras.set(name, value);
  }
}

export function createState(
  table: TableRelationalConfig,
  skipDeferredFragments: boolean,
  parent?: SelectionState,
): SelectionState {
  return {
    table,
    skipDeferredFragments,
    parent,
    query: {},
    columns: new Set(),
    with: new Map(),
    extras: new Map(),
    mappings: {},
    allColumns: false,
    depth: parent ? parent.depth + 1 : 0,
  };
}

export function mergeSelection(
  config: PothosDrizzleSchemaConfig,
  state: SelectionState,
  selection: SelectionMap | boolean,
) {
  const {
    with: withSelection,
    extras,
    columns,
    ...query
  } = typeof selection === 'boolean' ? (selection === true ? {} : { columns: {} }) : selection;
  if (withSelection) {
    for (const [key, value] of Object.entries(withSelection)) {
      const relation = state.table.relations[key];

      if (!relation) {
        throw new PothosValidationError(`Relation ${key} does not exist on ${state.table.name}`);
      }

      merge(config.relations[relation.targetTableName], key, value as SelectionMap | boolean);
    }
  }

  if (Object.keys(query).length > 0) {
    state.query = query;
  }

  if (extras) {
    for (const [key, value] of Object.entries(extras)) {
      state.extras.set(key, value);
    }
  }

  if (state.allColumns) {
    return;
  }

  if (columns && !state.allColumns) {
    for (const key of Object.keys(columns)) {
      state.columns.add(key);
    }
  } else {
    state.allColumns = true;
  }

  function merge(table: TableRelationalConfig, key: string, value?: SelectionMap | boolean) {
    if (!value) {
      return;
    }

    if (state.with.has(key)) {
      mergeSelection(config, state.with.get(key)!, value);
    } else {
      const relatedState = createState(table, state.skipDeferredFragments, state);
      mergeSelection(config, relatedState, value);
      state.with.set(key, relatedState);
    }
  }
}

export function selectionToQuery(
  config: PothosDrizzleSchemaConfig,
  state: SelectionState,
): SelectionMap {
  const query: SelectionMap & { extras: Record<string, unknown> } = {
    ...state.query,
    columns: undefined,
    with: {},
    extras: {},
  };

  if (!state.allColumns) {
    query.columns = {};
    for (const key of state.columns) {
      query.columns![key] = true;
    }

    if (!state.aggregation) {
      for (const column of config.getPrimaryKey(state.table.name)) {
        const tsName = config.columnToTsName(column);
        query.columns![tsName] = true;
      }
    }
  }

  for (const [key, value] of state.extras) {
    query.extras![key] = value;
  }

  state.with.forEach((sel, relation) => {
    query.with![relation] = selectionToQuery(config, sel);
  });

  return query;
}
