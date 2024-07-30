/* eslint-disable no-param-reassign */
import {
  DBQueryConfig,
  RelationalSchemaConfig,
  SQL,
  TableRelationalConfig,
  TablesRelationalConfig,
  getOperators,
} from 'drizzle-orm';
import { PothosValidationError } from '@pothos/core';
import { deepEqual } from './deep-equal';
import { LoaderMappings } from './loader-map';
import { PothosDrizzleSchemaConfig } from './config';

export interface SelectionState {
  table: TableRelationalConfig;
  query: object;
  allColumns: boolean;
  columns: Set<string>;
  with: Map<string, SelectionState>;
  extras: Map<string, SQL.Aliased>;
  mappings: LoaderMappings;
  parent?: SelectionState;
  depth: number;
}

export type SelectionMap = DBQueryConfig<'one', false>;

export function selectionCompatible(
  state: SelectionState,
  selectionMap: SelectionMap | boolean,
  ignoreQuery = false,
): boolean {
  if (typeof selectionMap === 'boolean') {
    return ignoreQuery || !selectionMap || Object.keys(state.query).length === 0;
  }

  const { with: withSelection, extras, columns, ...query } = selectionMap;

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

  const resolvedExtras =
    typeof extras === 'function' ? extras(state.table.columns, getOperators()) : extras;

  if (
    resolvedExtras &&
    Object.entries(resolvedExtras).some(([key, value]) => {
      const sql = state.extras.get(key);

      return sql && (sql.sql !== value.sql || sql.fieldAlias !== value.fieldAlias);
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

export function createState(table: TableRelationalConfig, parent?: SelectionState): SelectionState {
  return {
    table,
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
  { with: withSelection, extras, columns, ...query }: SelectionMap,
) {
  if (withSelection) {
    Object.entries(withSelection).forEach(([key, value]) => {
      const relation = state.table.relations[key];

      if (!relation) {
        throw new PothosValidationError(`Relation ${key} does not exist on ${state.table.dbName}`);
      }

      merge(config.dbToSchema[relation.referencedTableName], key, value as SelectionMap | boolean);
    });
  }

  if (Object.keys(query).length > 0) {
    state.query = query;
  }

  const resolvedExtras =
    typeof extras === 'function' ? extras(state.table.columns, getOperators()) : extras;

  if (resolvedExtras) {
    for (const [key, value] of Object.entries(resolvedExtras)) {
      state.extras.set(key, value);
    }
  }

  if (state.allColumns) {
    return;
  }

  if (columns) {
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

    const selection = value === true ? {} : value;

    if (state.with.has(key)) {
      mergeSelection(config, state.with.get(key)!, selection);
    } else {
      const relatedState = createState(table, state);
      mergeSelection(config, relatedState, selection);
      state.with.set(key, relatedState);
    }
  }
}

export function selectionToQuery(state: SelectionState): SelectionMap {
  const query: SelectionMap & { extras: Record<string, unknown> } = {
    ...state.query,
    with: {},
    columns: {},
    extras: {},
  };

  if (state.allColumns) {
    for (const key of Object.keys(state.table.columns)) {
      query.columns![key] = true;
    }
  } else {
    for (const key of state.columns) {
      query.columns![key] = true;
    }
    for (const { name } of state.table.primaryKey) {
      query.columns![name] = true;
    }
  }

  for (const [key, value] of state.extras) {
    query.extras![key] = value;
  }

  state.with.forEach((sel, relation) => {
    query.with![relation] = selectionToQuery(sel);
  });

  return query;
}
