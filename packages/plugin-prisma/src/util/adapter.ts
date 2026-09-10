import {
  deepEqual,
  type EntryVisitor,
  type Node,
  NodeAdapter,
  type Plan,
  type PlayedPlan,
  type SelectFn,
} from '@pothos/selection-mapper';
import type { GraphQLField, GraphQLNamedType } from 'graphql';
import type { FieldSelection, IncludeMap, SelectionMap } from '../types.js';
import type { FieldMap } from './relation-map.js';

export type PrismaNode = Node<FieldMap>;
export type PrismaPlan = Plan<FieldMap, SelectionMap>;
export type PrismaPlayedPlan = PlayedPlan<FieldMap, SelectionMap>;
type PrismaVisitor = EntryVisitor<FieldMap, SelectionMap>;

/** A map without `select`: include mode, every column. Shared and never mutated. */
export const INCLUDE_ALL: SelectionMap = Object.freeze({});

/**
 * The extras key standing for `_count: true` (every list relation counted). No relation can be
 * named `*`, so it never collides with a named count.
 */
const COUNT_ALL = '*';

/**
 * How prisma selections (`{ select, include, ...args }`) read onto the shared query tree, and how
 * a node is written back. A node in named-column mode serializes to `select`; a node whose
 * columns are `null` (include mode, the default for a type without a type-level `select`)
 * serializes to `include`. `_count` entries live in the node's extras, keyed by relation name.
 *
 * The merge, compare and conflict rules are `NodeAdapter`'s: this is the schema side, the key
 * loop and `emit`.
 */
class PrismaAdapter extends NodeAdapter<FieldMap, SelectionMap> {
  // Set by prismaObject/prismaInterface and propagated to implementing types by onTypeConfig.
  modelFor(type: GraphQLNamedType) {
    return type.extensions?.pothosPrismaFieldMap as FieldMap | undefined;
  }

  // Precomputed once per type by onTypeConfig: `{ select, include }`, INCLUDE_ALL, or undefined.
  typeSelection(type: GraphQLNamedType) {
    return type.extensions?.pothosPrismaTypeSelection as SelectionMap | undefined;
  }

  fieldSelection(field: GraphQLField<unknown, unknown>) {
    const selection = field.extensions?.pothosPrismaSelect as FieldSelection | undefined;

    if (!selection) {
      return undefined;
    }

    return typeof selection === 'function'
      ? (selection as unknown as SelectFn<SelectionMap>)
      : { select: selection };
  }

  read({ select, include, ...args }: SelectionMap, model: FieldMap, visit: PrismaVisitor) {
    // A map without `select` is an include-mode map, and include mode is final (S-9).
    if (!select) {
      visit.allColumns();
    }

    readKeys(include, model, visit);
    readKeys(select, model, visit);
    visit.args(args);
  }

  /**
   * M-3 for one count: a named count already on the node must be equal, and `_count: true` only
   * agrees with unfiltered counts.
   */
  override extraConflicts(extras: ReadonlyMap<string, unknown>, name: string, value: unknown) {
    if (name === COUNT_ALL) {
      for (const [count, filter] of extras) {
        if (count !== COUNT_ALL && filter !== true) {
          return true;
        }
      }

      return false;
    }

    if (extras.has(name)) {
      return !deepEqual(extras.get(name), value);
    }

    return extras.has(COUNT_ALL) && value !== true;
  }

  emit(node: PrismaNode): SelectionMap {
    const nested: Record<string, SelectionMap | boolean> = {};

    for (const [name, child] of node.relations) {
      const query = this.emit(child);

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
  }
}

export const prismaAdapter = new PrismaAdapter();

/**
 * Whether an object has any own enumerable key. `emit` writes `true` rather than an empty map for
 * a relation nothing was selected under, and `{ ...args }` rather than an empty `include`, so it
 * must tell an empty selection from a populated one.
 */
function hasKeys(value: object) {
  return Object.keys(value).length > 0;
}

/** M-1, M-2: the entries of a `select` or `include` map, classified against the model. */
function readKeys(map: IncludeMap | undefined, model: FieldMap, visit: PrismaVisitor) {
  if (!map) {
    return;
  }

  for (const key of Object.keys(map)) {
    const value = map[key];

    if (!value) {
      continue;
    }

    if (key === '_count') {
      readCounts(value, visit);

      continue;
    }

    const target = model.relations.get(key);

    if (target) {
      visit.relation(key, target, value === true ? INCLUDE_ALL : value);
    } else {
      visit.column(key);
    }
  }
}

/**
 * Counts are extras, one entry per counted relation, so a conflicting count leaves the others in
 * (E-2). A type-level conflict on one is reported as a relation conflict: it is a relation's
 * arguments that clash, not a computed value defined twice.
 */
function readCounts(value: SelectionMap | true, visit: PrismaVisitor) {
  if (value === true) {
    visit.extra(COUNT_ALL, true, 'relation');

    return;
  }

  const counts = (value as { select?: Record<string, unknown> }).select ?? {};

  for (const count of Object.keys(counts)) {
    visit.extra(count, counts[count], 'relation');
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
