import type { SelectFn } from '@pothos/selection-mapper';
import type { MapperCollection } from './adapter.js';

export const REFINE = Symbol('prismaNextRefine');
export const COMPUTE = Symbol('prismaNextCompute');

export type Refine = (rel: MapperCollection) => MapperCollection;
/** Computes a count, or an aggregate's values by key, from a to-many relation's collection. */
export type Compute = (rel: MapperCollection) => unknown;

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
 * The args of a relation load. The selection key identifies the load (see loads.ts), so equal keys
 * have equal args. The function that applies the load is under a symbol key, which the comparison
 * ignores.
 */
export interface RelationArgs {
  variant?: Narrowing;
  /** Set when the load applies a connection's cursor values, which the database may refuse. */
  cursors?: true;
  /** Set beside `REFINE`, since the mapper keeps only args with a string key. */
  refined?: true;
  [REFINE]?: Refine;
}

export interface ComputedSelection {
  kind: 'count' | 'agg';
  [COMPUTE]: Compute;
}

/**
 * A selection on one model. Planned node trees are written back in the same shape. A relation's
 * plain load is keyed by its name, and any other load of it, or value computed from it,
 * `relation:id`. They load as `combine()` branches of one include.
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

/** The relation a selection key loads, and the id of a load other than its plain one. */
export function splitKey(key: string): [relation: string, id?: string] {
  const separator = key.indexOf(':');
  return separator < 0 ? [key] : [key.slice(0, separator), key.slice(separator + 1)];
}

/** Whether a load of `selection` applies a connection's cursor values, at any level. */
export function appliesCursors({ args, relations }: PrismaNextSelection): boolean {
  return (
    args?.cursors === true || Object.values(relations ?? {}).some((child) => appliesCursors(child))
  );
}
