/* eslint-disable no-param-reassign */
/* eslint-disable no-underscore-dangle */
import { LoaderMappings, SelectionMap } from '../types';
import { deepEqual } from './deep-equal';
import { FieldMap } from './relation-map';

export type SelectionMode = 'include' | 'select';

export interface SelectionState {
  fieldMap: FieldMap;
  query: object;
  mode: SelectionMode;
  fields: Set<string>;
  counts: Map<string, Record<string, unknown> | boolean>;
  relations: Map<string, SelectionState>;
  mappings: LoaderMappings;
  parent?: SelectionState;
}

export function selectionCompatible(
  state: SelectionState,
  selectionMap: SelectionMap | boolean,
  ignoreQuery = false,
): boolean {
  if (typeof selectionMap === 'boolean') {
    return ignoreQuery || !selectionMap || Object.keys(state.query).length === 0;
  }

  const { select, include, ...query } = selectionMap;

  if (select && Object.keys(select).some((key) => compare(key, select[key]))) {
    return false;
  }

  if (include && Object.keys(include).some((key) => compare(key, include[key]))) {
    return false;
  }

  return ignoreQuery || deepEqual(state.query, query);

  function compare(key: string, value: SelectionMap | boolean) {
    if (key === '_count') {
      const selections = value && (value as { select?: Record<string, unknown> }).select;
      const keys = selections && Object.keys(selections);

      if (!keys || keys.length === 0) {
        return false;
      }

      return keys.some(
        (k) => state.counts.has(k) && !deepEqual(state.counts.get(k), selections[k]),
      );
    }

    return (
      value &&
      state.fieldMap.relations.has(key) &&
      state.relations.has(key) &&
      !selectionCompatible(state.relations.get(key)!, value)
    );
  }
}

export function stateCompatible(
  state: SelectionState,
  newState: SelectionState,
  ignoreQuery = false,
): boolean {
  for (const [name, relationState] of newState.relations) {
    if (state.relations.has(name) && !stateCompatible(state.relations.get(name)!, relationState)) {
      return false;
    }
  }

  return ignoreQuery || deepEqual(state.query, newState.query);
}

export function mergeState(state: SelectionState, newState: SelectionState) {
  for (const [name, relationState] of newState.relations) {
    if (state.relations.has(name)) {
      mergeState(state.relations.get(name)!, relationState);
    }
  }

  if (newState.mode === 'include') {
    state.mode = 'include';
  } else {
    for (const name of newState.fields) {
      state.fields.add(name);
    }
  }
}

export function createState(
  fieldMap: FieldMap,
  mode: SelectionMode,
  parent?: SelectionState,
): SelectionState {
  return {
    parent,
    mode,
    fieldMap,
    query: {},
    fields: new Set(),
    counts: new Map(),
    relations: new Map(),
    mappings: {},
  };
}

export function mergeSelection(state: SelectionState, { select, include, ...query }: SelectionMap) {
  if (state.mode === 'select' && !select) {
    state.mode = 'include';
  }

  if (include) {
    Object.keys(include).forEach((key) => {
      merge(key, include[key]);
    });
  }

  if (select) {
    Object.keys(select).forEach((key) => {
      merge(key, select[key]);
    });
  }

  if (Object.keys(query).length > 0) {
    state.query = query;
  }

  function merge(key: string, value: SelectionMap | boolean) {
    if (!value) {
      return;
    }

    if (key === '_count') {
      const counts = (value as { select?: Record<string, boolean> }).select ?? {};
      Object.keys(counts).forEach((count) => {
        state.counts.set(count, counts[count]);
      });

      return;
    }

    const selection = value === true ? { include: {} } : value;
    const childMap = state.fieldMap.relations.get(key);

    if (childMap) {
      if (state.relations.has(key)) {
        mergeSelection(state.relations.get(key)!, selection);
      } else {
        const relatedState = createState(childMap, 'select');
        mergeSelection(relatedState, selection);
        state.relations.set(key, relatedState);
      }
    } else {
      state.fields.add(key);
    }
  }
}

export function selectionToQuery(state: SelectionState): SelectionMap {
  const nestedIncludes: Record<string, SelectionMap | boolean> = {};
  const counts: Record<string, unknown> = {};

  let hasSelection = false;

  state.relations.forEach((sel, relation) => {
    hasSelection = true;
    const nested = selectionToQuery(sel);
    nestedIncludes[relation] = Object.keys(nested).length > 0 ? nested : true;
  });

  if (state.counts.size > 0) {
    hasSelection = true;
    for (const [count, selection] of state.counts) {
      counts[count] = selection;
    }

    nestedIncludes._count = {
      select: counts as {},
    };
  }

  if (state.mode === 'select') {
    state.fields.forEach((field) => {
      hasSelection = true;
      nestedIncludes[field] = true;
    });

    return {
      ...(state.query as SelectionMap),
      select: nestedIncludes,
    };
  }

  return hasSelection
    ? {
        ...state.query,
        include: nestedIncludes,
      }
    : (state.query as SelectionMap);
}
