import type { SelectFn } from '@pothos/selection-mapper';
import type { MapperCollection } from './adapter.js';
import { consumerOfKey, fieldOnlyKey } from './branch-keys.js';
import { isNestedId } from './consumers.js';

export const REFINE = Symbol('prismaNextRefine');
export const COMPUTE = Symbol('prismaNextCompute');

export type Refine = (rel: MapperCollection) => MapperCollection | null | undefined;
/** Computes values from a to-many relation's collection, as `combine()` entries by key. */
export type Compute = (rel: MapperCollection) => Record<string, unknown>;

/**
 * The variant a level of the query is narrowed to. By default the base collection is narrowed with
 * `.variant(value)`. A relation that targets a variant model loads through that model's own
 * accessor instead, which is already narrowed and has only that variant's relations.
 */
export interface Narrowing {
  value: string;
  throughVariantModel?: boolean;
}

/**
 * Identifies a relation load. Loads with structurally equal args share one include. The function
 * that applies the load is stored under a symbol key, which the comparison ignores.
 */
export interface RelationArgs {
  /** A declarative query object, or the field that defines the load together with its arguments. */
  loadIdentity?: unknown;
  variant?: Narrowing;
  /**
   * Set when the load applies a connection's cursor values, which the database may refuse. Loads
   * that share it are of one page with the same cursors.
   */
  cursors?: true;
  [REFINE]?: Refine;
}

export interface ComputedSelection {
  /** Tells apart the values one consumer computes from one relation. */
  key: string;
  /** Identifies the computed value, like `RelationArgs.loadIdentity`. */
  loadIdentity: unknown;
  [COMPUTE]: Compute;
}

/**
 * A selection on one model. Planned node trees are written back in the same shape. A to-many
 * relation is keyed `relation:id`, and values computed from it `relation:id:key`. Consumers with
 * different arguments then get separate `combine()` branches and still load in one statement. A
 * to-one relation is always loaded whole and keyed by its name, so every reader of the row sees it
 * there.
 */
export interface PrismaNextSelection {
  /** `null` selects every column. */
  columns?: readonly string[] | null;
  relations?: Record<string, PrismaNextSelection>;
  computed?: Record<string, ComputedSelection>;
  args?: RelationArgs;
}

export type PrismaNextSelectFn = SelectFn<PrismaNextSelection>;

export const EMPTY: PrismaNextSelection = Object.freeze({});

/** Whether a load of `selection` applies a connection's cursor values, at any level. */
export function appliesCursors({ args, relations }: PrismaNextSelection): boolean {
  return (
    args?.cursors === true || Object.values(relations ?? {}).some((child) => appliesCursors(child))
  );
}

/** The key a connection's count is computed under, as a value only its field reads. */
export const COUNT_SLOT = fieldOnlyKey('count');

/** The key `relationCount` computes its count under, as a value only its field reads. */
export const VALUE_SLOT = fieldOnlyKey('value');

/**
 * Whether a relation load has every row of the relation, rather than a filtered or paged part, and
 * nothing a nested `select` writes beneath them, which rows other plans load whole would lack.
 */
export function loadsWholeRelation({ args, relations, computed }: PrismaNextSelection) {
  return (
    args?.loadIdentity === undefined &&
    (!args?.variant || args.variant.throughVariantModel === true) &&
    ![...Object.keys(relations ?? {}), ...Object.keys(computed ?? {})].some((key) =>
      isNestedId(consumerOfKey(key)),
    )
  );
}
