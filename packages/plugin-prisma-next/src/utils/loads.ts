import { createContextCache } from '@pothos/core';
import { deepEqual, type Position } from '@pothos/selection-mapper';
import type { PrismaNextConfig } from './config.js';
import { isOrderByDecl, type OrderByOption } from './cursors.js';
import type { PrismaNextModel } from './model.js';

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

const tables = createContextCache(
  () => new Map<string, { loads: Load[]; seen: WeakMap<Load, number> }>(),
);

/** The index of `load` among the distinct loads of its relation seen in `ctx`. */
function internLoad(ctx: object, model: PrismaNextModel, load: Load): number {
  const tablesOf = tables(ctx);
  const key = `${model.key}.${load.relation}`;
  const table =
    tablesOf.get(key) ?? tablesOf.set(key, { loads: [], seen: new WeakMap() }).get(key)!;
  let id = table.seen.get(load);
  if (id === undefined) {
    id = table.loads.findIndex((seen) => deepEqual(seen, load));
    if (id < 0) {
      id = table.loads.push(load) - 1;
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
  readonly model: PrismaNextModel;
  /** Whether the field reads a view of the parent with its loads under their names. */
  readonly view: boolean;
}

function plainLoad(config: PrismaNextConfig, model: PrismaNextModel, relation: string): Load {
  return config.typeLoads.get(model.key)?.get(relation)?.load ?? { kind: 'rows', relation };
}

/** Every to-one load is plain, read under the relation's name. */
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

export function keyOf({ load, id }: LoadRef) {
  return id === undefined ? load.relation : `${load.relation}:${id}`;
}

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
