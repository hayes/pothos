import type { SelectFn } from '@pothos/selection-mapper';
import type { MapperCollection } from './adapter.js';

export const REFINE = Symbol('prismaNextRefine');
export const COMPUTE = Symbol('prismaNextCompute');

export type Refine = (rel: MapperCollection) => MapperCollection;
export type Compute = (rel: MapperCollection) => unknown;

/**
 * By default the base collection is narrowed with `.variant(value)`. A relation targeting a
 * variant model loads through that model's own accessor instead, which is already narrowed.
 */
export interface Narrowing {
  value: string;
  throughVariantModel?: boolean;
}

/** Equal selection keys have equal args, so the refinement sits under an ignored symbol. */
export interface RelationArgs {
  variant?: Narrowing;
  /** The load applies cursor values, which the database may refuse. */
  cursors?: true;
  /** Set beside `REFINE`, since the mapper keeps only args with a string key. */
  refined?: true;
  [REFINE]?: Refine;
}

export interface ComputedSelection {
  kind: 'count' | 'agg';
  [COMPUTE]: Compute;
}

/** A relation's plain load is keyed by its name; any other load or computed value `relation:id`. */
export interface PrismaNextSelection {
  /** `null` selects every column. */
  columns?: readonly string[] | null;
  relations?: Record<string, PrismaNextSelection>;
  computed?: Record<string, ComputedSelection>;
  args?: RelationArgs;
}

export type PrismaNextSelectFn = SelectFn<PrismaNextSelection>;

export const EMPTY: PrismaNextSelection = Object.freeze({});

export function splitKey(key: string): [relation: string, id?: string] {
  const separator = key.indexOf(':');
  return separator < 0 ? [key] : [key.slice(0, separator), key.slice(separator + 1)];
}

export function appliesCursors({ args, relations }: PrismaNextSelection): boolean {
  return (
    args?.cursors === true || Object.values(relations ?? {}).some((child) => appliesCursors(child))
  );
}
