import { createContextCache } from '@pothos/core';
import { deepEqual, type Position } from '@pothos/selection-mapper';
import type { PrismaNextConfig } from './config.js';
import { isOrderByDecl, type OrderByOption } from './cursors.js';
import type { PrismaNextModel } from './model.js';

/*
 * A load is named by what it loads: a plain descriptor compared with `deepEqual`, never by the
 * field, alias or type asking for it. A relation's plain load, the model's type-level one or the
 * whole relation, is keyed by the relation's name. Any other load gets an id interned per context,
 * keyed `relation:id`, so equal loads share a key, which the mapper merges, and a branch.
 */

export type LoadKind = 'rows' | 'count' | 'agg';

/** What a load loads. Entries holding callbacks a select function builds per call use `fn`. */
export interface Load {
  readonly kind: LoadKind;
  readonly relation: string;
  readonly variant?: string;
  readonly where?: unknown;
  readonly orderBy?: unknown;
  readonly limit?: number;
  readonly offset?: number;
  /** The function that built the load's callbacks, and its arguments and place in a select. */
  readonly fn?: unknown;
  readonly args?: object;
  readonly at?: string;
  /** A connection page: its order and sizes, resolved, and its paging arguments. */
  readonly page?: object;
}

export interface DeclarativeQuery {
  where?: unknown;
  orderBy?: OrderByOption;
  limit?: number;
  offset?: number;
}

/**
 * The load of `query`, by its data: an `orderBy` declaration as its ordered entries, since rows
 * are ordered by its columns in the order written. When the query holds a callback `built` makes
 * anew on every call, the load is `built`'s.
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

const tables = createContextCache(() => ({
  seen: new WeakMap<Load, number>(),
  byRelation: new Map<string, Load[]>(),
}));

/** The id of `load` in `ctx`: its index among the distinct loads of its relation seen there. */
function internLoad(ctx: object, model: PrismaNextModel, load: Load): number {
  const table = tables(ctx);
  let id = table.seen.get(load);
  if (id === undefined) {
    const key = `${model.key}.${load.relation}`;
    let loads = table.byRelation.get(key);
    if (!loads) {
      loads = [];
      table.byRelation.set(key, loads);
    }
    id = loads.findIndex((seen) => deepEqual(seen, load));
    if (id < 0) {
      id = loads.push(load) - 1;
    }
    table.seen.set(load, id);
  }
  return id;
}

/** Where a field reads one of its loads: the plain name, or the branch of `id`. */
export interface LoadRef {
  readonly load: Load;
  readonly id?: number;
  /** The loads a nested `select` writes on the rows, which the field's view reads. */
  readonly beneath?: FieldLoads;
  /** A connection helper's page's count. */
  readonly count?: LoadRef;
  /**
   * Set for a load the field didn't plan because its selection didn't need it. Another field node
   * of its response key may have planned it.
   */
  readonly unplanned?: true;
}

/** What a field's select loads on its parent's rows, of `model`. */
export interface FieldLoads {
  readonly refs: readonly LoadRef[];
  readonly model: PrismaNextModel;
  /** Whether the field reads a view of the parent with its loads under their names. */
  readonly view: boolean;
  /** A `t.relatedConnection`'s paging. */
  readonly plan?: unknown;
}

/** The load of relation `relation` every reader of `model`'s rows reads under its name. */
function plainLoad(config: PrismaNextConfig, model: PrismaNextModel, relation: string): Load {
  return config.typeLoads.get(model.key)?.get(relation)?.load ?? { kind: 'rows', relation };
}

/**
 * Where `load` of `model`'s rows sits: under its name when it's the relation's plain load, which
 * every to-one load is, or in a branch of its id in `ctx`.
 */
export function refOf(
  config: PrismaNextConfig,
  ctx: object,
  model: PrismaNextModel,
  load: Load,
): LoadRef {
  return !model.relations[load.relation]!.isToMany ||
    deepEqual(load, plainLoad(config, model, load.relation))
    ? { load }
    : { load, id: internLoad(ctx, model, load) };
}

/** The selection key of the load `ref` reads. */
export function keyOf({ load, id }: LoadRef) {
  return id === undefined ? load.relation : `${load.relation}:${id}`;
}

/** The loads of `model`'s rows `refs` read, with a view when any is not read by its plain name. */
export function fieldLoads(model: PrismaNextModel, refs: readonly LoadRef[]): FieldLoads {
  return {
    refs,
    model,
    view: refs.some(
      (ref) => ref.id !== undefined || ref.load.kind !== 'rows' || ref.count || ref.beneath?.view,
    ),
  };
}

const loadsAt = new WeakMap<Position, FieldLoads>();

/** Records what the field planned at `position` loads. */
export function record(position: Position, loads: FieldLoads) {
  loadsAt.set(position, loads);
}

export function recorded(position: Position | undefined): FieldLoads | undefined {
  return position && loadsAt.get(position);
}

/** What the field executing at each `info.path` reads, set by its gate. */
const executing = new WeakMap<object, FieldLoads>();

export function setOwnLoads(path: object, loads: FieldLoads | undefined) {
  if (loads) {
    executing.set(path, loads);
  }
}

export function ownLoads(path: object): FieldLoads | undefined {
  return executing.get(path);
}
