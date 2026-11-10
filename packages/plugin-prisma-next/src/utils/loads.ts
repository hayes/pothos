import { createContextCache } from '@pothos/core';
import { deepEqual, type Position } from '@pothos/selection-mapper';
import type { PrismaConfig } from './config.js';
import { isOrderByDecl, type OrderByOption } from './cursors.js';
import type { PrismaModel } from './model.js';

/*
 * A load is named by what it loads (a descriptor compared with `deepEqual`), never by the field,
 * alias or type asking for it. A relation's plain load is keyed by the relation's name. Any other
 * gets an id interned per context, keyed `relation:id`, so equal loads share a key and a branch.
 */

export type LoadKind = 'rows' | 'count' | 'agg';

/** Entries holding callbacks a select function builds per call are identified by `fn`. */
export interface Load {
  readonly kind: LoadKind;
  readonly relation: string;
  readonly variant?: string;
  readonly where?: unknown;
  readonly orderBy?: unknown;
  readonly limit?: number;
  readonly offset?: number;
  readonly fn?: unknown;
  readonly args?: object;
  readonly at?: string;
  readonly page?: object;
}

export interface DeclarativeQuery {
  where?: unknown;
  orderBy?: OrderByOption;
  limit?: number;
  offset?: number;
}

/**
 * An `orderBy` declaration becomes its ordered entries, since key order matters. A query holding
 * a callback built anew per call is identified by `built`.
 */
export function queryLoad(
  kind: LoadKind,
  relation: string,
  variant: string | undefined,
  query: DeclarativeQuery | undefined,
  built?: () => Pick<Load, 'fn' | 'args' | 'at'>,
): Load {
  // Only the top-level options, and an `orderBy`'s list of selectors, are checked for callbacks.
  if (
    built &&
    query &&
    Object.values(query).some(
      (option) =>
        typeof option === 'function' ||
        (Array.isArray(option) && option.some((item) => typeof item === 'function')),
    )
  ) {
    return { kind, relation, variant, ...built() };
  }
  const { orderBy } = query ?? {};
  return {
    kind,
    relation,
    variant,
    ...query,
    orderBy: isOrderByDecl(orderBy)
      ? Object.entries(orderBy).filter(([, direction]) => direction)
      : orderBy,
  };
}

interface LoadTable {
  size: number;
  /** The loads seen and their indices, by `bucketOf`. */
  buckets: Map<string, { load: Load; id: number }[]>;
  seen: WeakMap<Load, number>;
}

const tables = createContextCache(() => new Map<string, LoadTable>());

/** Loads that `deepEqual` share a bucket, so only a bucket is compared. */
function bucketOf({ kind, variant, limit, offset }: Load) {
  return `${kind}:${variant}:${limit}:${offset}`;
}

/** The index of `load` among the distinct loads of its relation seen in `ctx`. */
function internLoad(ctx: object, model: PrismaModel, load: Load): number {
  const tablesOf = tables(ctx);
  const key = `${model.key}.${load.relation}`;
  const table =
    tablesOf.get(key) ??
    tablesOf.set(key, { size: 0, buckets: new Map(), seen: new WeakMap() }).get(key)!;
  let id = table.seen.get(load);
  if (id === undefined) {
    const bucket = bucketOf(load);
    const seen = table.buckets.get(bucket) ?? table.buckets.set(bucket, []).get(bucket)!;
    id = seen.find((entry) => deepEqual(entry.load, load))?.id;
    if (id === undefined) {
      id = table.size++;
      seen.push({ load, id });
    }
    table.seen.set(load, id);
  }
  return id;
}

/** Where a field reads one of its loads: the plain name, or the branch of `id`. */
export interface LoadRef {
  readonly load: Load;
  readonly id?: number;
  /** The loads a nested `select` writes on the rows. */
  readonly beneath?: FieldLoads;
  readonly count?: LoadRef;
  /** Not planned by this field node; another node of its response key may have planned it. */
  readonly unplanned?: true;
}

export interface FieldLoads {
  readonly refs: readonly LoadRef[];
  readonly model: PrismaModel;
  /** Whether the field reads a view of the parent with its loads under their names. */
  readonly view: boolean;
}

function plainLoad(config: PrismaConfig, model: PrismaModel, relation: string): Load {
  return config.typeLoads.get(model.key)?.get(relation)?.load ?? { kind: 'rows', relation };
}

/** Every to-one load is plain, read under the relation's name. */
export function refOf(config: PrismaConfig, ctx: object, model: PrismaModel, load: Load): LoadRef {
  return !model.relations[load.relation]!.isToMany ||
    deepEqual(load, plainLoad(config, model, load.relation))
    ? { load }
    : { load, id: internLoad(ctx, model, load) };
}

export function keyOf({ load, id }: LoadRef) {
  return id === undefined ? load.relation : `${load.relation}:${id}`;
}

export function fieldLoads(model: PrismaModel, refs: readonly LoadRef[]): FieldLoads {
  return {
    refs,
    model,
    view: refs.some(
      (ref) => ref.id !== undefined || ref.load.kind !== 'rows' || ref.count || ref.beneath?.view,
    ),
  };
}

const loadsAt = new WeakMap<Position, FieldLoads>();

export function record(position: Position, loads: FieldLoads) {
  loadsAt.set(position, loads);
}

export function recorded(position: Position | undefined): FieldLoads | undefined {
  return position && loadsAt.get(position);
}

/** Set by each field's gate, by `info.path`. */
const executing = new WeakMap<object, FieldLoads | undefined>();

export function setOwnLoads(path: object, loads: FieldLoads | undefined) {
  executing.set(path, loads);
}

/** The load of `t.relation`, `relationCount` or `t.relatedConnection` executing for `info`. */
export function ownRef(info: { path: object }): LoadRef | undefined {
  return executing.get(info.path)?.refs[0];
}
