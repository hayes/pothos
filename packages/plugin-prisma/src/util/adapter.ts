import {
  type Adapter,
  createNode,
  deepEqual,
  type Node,
  type Plan,
  relation,
  type SelectFn,
} from '@pothos/selection-mapper';
import type { FieldSelection, IncludeMap, SelectionMap } from '../types.js';
import type { FieldMap } from './relation-map.js';

export type PrismaNode = Node<FieldMap>;
export type PrismaPlan = Plan<FieldMap, SelectionMap>;

/** A map without `select`: include mode, every column. Shared and never mutated. */
export const INCLUDE_ALL: SelectionMap = Object.freeze({});

/**
 * The extras key standing for `_count: true` (every list relation counted). No relation can be
 * named `*`, so it never collides with a named count.
 */
const COUNT_ALL = '*';

/**
 * How prisma selections (`{ select, include, ...args }`) map onto the shared query tree. A node
 * in named-column mode serializes to `select`; a node whose columns are `null` (include mode, the
 * default for a type without a type-level `select`) serializes to `include`. `_count` entries
 * live in the node's extras, keyed by relation name.
 */
export const prismaAdapter: Adapter<FieldMap, SelectionMap> = {
  skipDeferredFragments: true,
  // Set by prismaObject/prismaInterface and propagated to implementing types by onTypeConfig.
  modelFor: (type) => type.extensions?.pothosPrismaFieldMap as FieldMap | undefined,
  createNode,
  // Precomputed once per type by onTypeConfig: `{ select, include }`, INCLUDE_ALL, or undefined.
  typeSelection: (type) => type.extensions?.pothosPrismaTypeSelection as SelectionMap | undefined,
  fieldSelection(field) {
    const selection = field.extensions?.pothosPrismaSelect as FieldSelection | undefined;

    if (!selection) {
      return undefined;
    }

    return typeof selection === 'function'
      ? (selection as unknown as SelectFn<SelectionMap>)
      : { select: selection };
  },
  merge(node, { select, include, ...args }) {
    // A map without `select` is an include-mode map, and include mode is final (S-9).
    if (!select) {
      node.columns = null;
    }

    mergeKeys(node, include);
    mergeKeys(node, select);

    if (hasKeys(args)) {
      node.args = args;
    }
  },
  // A relation query merges over `{ select: {} }`: without a `select` of its own it stays in
  // named-column mode with no columns, so it never means "every column".
  mergeQuery(node, query) {
    if (query && hasKeys(query)) {
      prismaAdapter.merge(node, { select: {}, ...query });
    }
  },
  compatible(node, { select, include, ...args }, ignoreArgs) {
    return (
      keysCompatible(node, select) &&
      keysCompatible(node, include) &&
      (ignoreArgs || deepEqual(node.args, args))
    );
  },
  typeLevelConflict(node, { select, include }) {
    const name =
      Object.keys(select ?? {}).find((key) => !keyCompatible(node, key, select![key])) ??
      Object.keys(include ?? {}).find((key) => !keyCompatible(node, key, include![key]));

    return name === undefined ? undefined : { kind: 'relation', name };
  },
  withoutConflicts(node, { select, include }) {
    return {
      select: select && compatibleEntries(node, select),
      include: include && compatibleEntries(node, include),
    };
  },
  serialize(node) {
    const nested: Record<string, SelectionMap | boolean> = {};

    for (const [name, child] of node.relations) {
      const query = prismaAdapter.serialize(child);

      nested[name] = hasKeys(query) ? query : true;
    }

    if (node.extras.size > 0) {
      nested._count = serializeCounts(node);
    }

    if (node.columns) {
      for (const column of node.columns) {
        nested[column] = true;
      }

      return { ...node.args, select: nested };
    }

    return hasKeys(nested) ? { ...node.args, include: nested } : { ...node.args };
  },
};

/** M-1, M-2: merges the entries of a `select` or `include` map into `node`. */
function mergeKeys(node: PrismaNode, map: IncludeMap | undefined) {
  if (!map) {
    return;
  }

  for (const key of Object.keys(map)) {
    const value = map[key];

    if (!value) {
      continue;
    }

    if (key === '_count') {
      mergeCounts(node, value);

      continue;
    }

    const child = node.model.relations.get(key);

    if (child) {
      prismaAdapter.merge(relation(node, key, child, value), value === true ? INCLUDE_ALL : value);
    } else {
      node.columns?.add(key);
    }
  }
}

function mergeCounts(node: PrismaNode, value: SelectionMap | true) {
  if (value === true) {
    node.extras.set(COUNT_ALL, true);

    return;
  }

  const counts = (value as { select?: Record<string, unknown> }).select ?? {};

  for (const count of Object.keys(counts)) {
    node.extras.set(count, counts[count]);
  }
}

/**
 * `_count: true` stays `_count: true` as long as every named count on the node is a plain
 * `true`; a filtered named count cannot ride on it, so the counted relations are spelled out.
 */
function serializeCounts(node: PrismaNode): SelectionMap | true {
  const counts: Record<string, unknown> = {};
  let plain = true;

  for (const [name, count] of node.extras) {
    if (name !== COUNT_ALL) {
      counts[name] = count;
      plain &&= count === true;
    }
  }

  if (!node.extras.has(COUNT_ALL)) {
    return { select: counts as IncludeMap };
  }

  if (plain) {
    return true;
  }

  const all: Record<string, unknown> = {};

  for (const name of node.model.listRelations) {
    all[name] = true;
  }

  return { select: { ...all, ...counts } as IncludeMap };
}

function keysCompatible(node: PrismaNode, map: IncludeMap | undefined) {
  return !map || Object.keys(map).every((key) => keyCompatible(node, key, map[key]));
}

/**
 * M-3 for one entry: a relation already on the node must be compatible with the entry's value
 * (`true` is compatible iff the node's relation has no arguments); a count already on the node
 * must be equal, and `_count: true` only agrees with unfiltered counts.
 */
function keyCompatible(node: PrismaNode, key: string, value: SelectionMap | boolean) {
  if (!value) {
    return true;
  }

  if (key === '_count') {
    return countsCompatible(node, value);
  }

  const child = node.relations.get(key);

  return !child || prismaAdapter.compatible(child, value === true ? INCLUDE_ALL : value, false);
}

function countsCompatible(node: PrismaNode, value: SelectionMap | true) {
  if (value === true) {
    for (const [name, count] of node.extras) {
      if (name !== COUNT_ALL && count !== true) {
        return false;
      }
    }

    return true;
  }

  const counts = (value as { select?: Record<string, unknown> }).select;

  if (!counts) {
    return true;
  }

  const countAll = node.extras.has(COUNT_ALL);

  return Object.keys(counts).every((count) =>
    node.extras.has(count)
      ? deepEqual(node.extras.get(count), counts[count])
      : !countAll || counts[count] === true,
  );
}

/**
 * E-2: the entries of a type-level map that can be merged into `node`. Counts are checked one at
 * a time, so one conflicting count leaves the others in.
 */
function compatibleEntries(node: PrismaNode, map: IncludeMap): IncludeMap {
  const entries: IncludeMap = {};

  for (const [key, value] of Object.entries(map)) {
    if (key === '_count' && typeof value === 'object' && value.select) {
      const kept: IncludeMap = {};

      for (const [name, count] of Object.entries(value.select)) {
        if (countsCompatible(node, { select: { [name]: count } })) {
          kept[name] = count;
        }
      }

      if (hasKeys(kept)) {
        entries._count = { select: kept };
      }
    } else if (keyCompatible(node, key, value)) {
      entries[key] = value;
    }
  }

  return entries;
}

function hasKeys(value: object) {
  return Object.keys(value).length > 0;
}
