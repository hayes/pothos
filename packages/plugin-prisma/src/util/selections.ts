/* eslint-disable no-param-reassign */
/* eslint-disable no-underscore-dangle */
import { deepEqual } from './deep-equal';

import { IncludeMap, LoaderMappings, SelectionMap } from '..';

export type SelectionMode = 'select' | 'include';

export interface SelectionState {
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

  if (
    select &&
    Object.keys(select).some(
      (key) =>
        select[key] &&
        state.relations.has(key) &&
        !selectionCompatible(state.relations.get(key)!, select[key]),
    )
  ) {
    return false;
  }

  if (
    include &&
    Object.keys(include).some(
      (key) =>
        include[key] &&
        state.relations.has(key) &&
        !selectionCompatible(state.relations.get(key)!, include[key]),
    )
  ) {
    return false;
  }

  return ignoreQuery || queryCompatible(state, query);
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

export function createState(initialState: Partial<SelectionState> = {}): SelectionState {
  return {
    mode: 'include',
    query: {},
    fields: new Set(),
    counts: new Set(),
    relations: new Map(),
    mappings: {},
    ...initialState,
  };
}

export function mergeSelection(state: SelectionState, { select, include, ...query }: SelectionMap) {
  if (state.mode === 'select' && include) {
    state.mode = 'include';
  }

  if (include) {
    Object.keys(include).forEach((key) => {
      if (!include[key]) {
        return;
      }

      if (key === '_count') {
        const counts = (include._count as { select?: {} }).select ?? {};

        Object.keys(counts).forEach((count) => {
          state.counts.add(count);
        });
        return;
      }

      const selection = include[key] === true ? {} : (include[key] as SelectionMap);

      if (state.relations.has(key)) {
        mergeSelection(state.relations.get(key)!, selection);
      } else {
        const relatedState = createState({ parent: state });
        mergeSelection(relatedState, selection);

        state.relations.set(key, relatedState);
      }
    });
  }

  if (select) {
    Object.keys(select).forEach((key) => {
      if (!select[key]) {
        return;
      }

      if (key === '_count') {
        const counts = (select._count as { select?: {} }).select ?? {};
        Object.keys(counts).forEach((count) => {
          state.counts.add(count);
        });
        return;
      }

      const selection = select[key] === true ? {} : (select[key] as SelectionMap);

      if (state.relations.has(key)) {
        mergeSelection(state.relations.get(key)!, selection);
      } else {
        const relatedState = createState({ parent: state });
        mergeSelection(relatedState, selection);

        state.relations.set(key, relatedState);
      }
    });
  }

  if (Object.keys(query).length > 0) {
    state.query = query;
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
