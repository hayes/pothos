/* eslint-disable no-param-reassign */
/* eslint-disable no-underscore-dangle */
import { deepEqual } from './deep-equal';
import { FieldMap } from './relation-map';

import { IncludeMap, LoaderMappings, SelectionMap } from '..';

export type SelectionMode = 'select' | 'include';

export interface SelectionState {
  fieldMap: FieldMap;
  query: object;
  mode: SelectionMode;
  fields: Set<string>;
  counts: Set<string>;
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
    return ignoreQuery || queryCompatible(state, selectionMap);
  }

  const { select, include, ...query } = selectionMap;

  if (select && Object.keys(select).some((key) => compare(key, select[key]))) {
    return false;
  }

  if (include && Object.keys(include).some((key) => compare(key, include[key]))) {
    return false;
  }

  return ignoreQuery || queryCompatible(state, query);

  function compare(key: string, value: SelectionMap | boolean) {
    return (
      value &&
      state.fieldMap.relations.has(key) &&
      state.relations.has(key) &&
      !selectionCompatible(state.relations.get(key)!, value)
    );
  }
}

export function queryCompatible(state: SelectionState, query: boolean | object) {
  if (!query) {
    return true;
  }

  if (query === true) {
    return Object.keys(state.query).length === 0;
  }

  return deepEqual(query, state.query);
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
    counts: new Set(),
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
      const counts = (value as { select?: {} }).select ?? {};
      Object.keys(counts).forEach((count) => {
        state.counts.add(count);
      });

      return;
    }

    const selection = value === true ? {} : value;
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

export function selectionToQuery(state: SelectionState): IncludeMap {
  const nestedIncludes: Record<string, IncludeMap | boolean> = {};
  const counts: Record<string, boolean> = {};

  let hasSelection = false;

  const query = typeof state.query === 'object' ? (state.query as IncludeMap) : {};

  state.relations.forEach((sel, relation) => {
    hasSelection = true;
    const nested = selectionToQuery(sel);
    nestedIncludes[relation] = Object.keys(nested).length > 0 ? nested : true;
  });

  if (state.counts.size > 0) {
    hasSelection = true;
    for (const count of state.counts) {
      counts[count] = true;
    }

    nestedIncludes._count = {
      select: counts,
    };
  }

  if (state.mode === 'select') {
    state.fields.forEach((field) => {
      hasSelection = true;
      nestedIncludes[field] = true;
    });

    return hasSelection
      ? {
          ...query,
          select: nestedIncludes,
        }
      : { ...query };
  }

  return hasSelection
    ? {
        ...query,
        include: nestedIncludes,
      }
    : { ...query };
}
