import { brandWithType, getTypeBrand } from '@pothos/core';
import type { Position } from '@pothos/selection-mapper';
import type { GraphQLResolveInfo } from 'graphql';
import { PRISMA_NEXT_TYPE_NESTED } from '../constants.js';
import { consumerOfKey, isFieldOnlyKey, parseBranch, relationName } from './branch-keys.js';
import { consumerId, nestedId, TYPE_CONSUMER } from './consumers.js';
import type { PrismaNextModel } from './model.js';
import { COUNT_SLOT, loadsWholeRelation, type PrismaNextSelection } from './selections.js';

/*
 * Rows stay as the ORM returned them. A field returning rows hands each one on as a copy
 * (`typeCopy`): the `combine()` values come off the relation keys and go under `SLOTS`, and what
 * the type-level selects loaded is written back on. A field with a select of its own reads a copy
 * of that with its own branches written on (`fieldCopy`).
 *
 * A relation entry with a nested `select` loads the relation's rows with what that `select` names,
 * as consumer `nestedId(id)` of their level, and a copy of each row has its branches written on.
 */

/**
 * The relation entries of a consumer's `select` whose nested `select` writes branches on their
 * rows, each with those of its own nested `select`.
 */
export type NestedPlan = ReadonlyMap<string, NestedPlan>;

export const NO_NESTED: NestedPlan = new Map();

type Row = Record<string, unknown>;

/** What the consumers of one to-many relation loaded through `combine()`, by consumer id. */
interface RelationSlots {
  readonly rows: Record<string, unknown>;
  /** Values written onto the parent. */
  readonly values: Record<string, Row>;
  /** Values only the consumer's field reads. */
  readonly own: Record<string, Row>;
}

/** The `combine()` values of an ORM row, by relation, and every consumer id with a branch. */
interface Slots {
  readonly relations: Readonly<Record<string, RelationSlots>>;
  readonly consumers: ReadonlySet<string>;
}

/** What a copy holds under `SLOTS`. */
interface Held {
  /** The ORM row the copy was made from. */
  readonly row: object;
  readonly slots: Slots;
  /** For a field's copy, the consumer it was made for. */
  readonly field?: string;
}

/**
 * Where a copy keeps its row's `combine()` values. An enumerable property, so `{ ...parent }` and
 * `Object.assign` copies other plugins make keep them, and read from them as this plugin's copy
 * does. JSON and structuredClone copies drop it.
 */
const SLOTS = Symbol('prismaNextSlots');

type Holder = { [SLOTS]?: Held };

const NO_SLOTS: Slots = Object.freeze({
  relations: Object.freeze({}),
  consumers: new Set<string>(),
});

/** What `slotsOf` read off each ORM row. */
const parsed = new WeakMap<object, Slots>();
declare const executionKeyBrand: unique symbol;

/** The key of an execution (see `executionKey`). */
export type ExecutionKey = object & { readonly [executionKeyBrand]: true };

/**
 * The executions whose plans loaded each ORM row (see `executionKey`). Consumer ids are numbered
 * per operation, so the same id names another consumer in another operation, or reads other
 * arguments in another execution of this one. The rows beneath a row share its set, which they are
 * given when the row is first read (see `slotsOf`).
 */
const plannedIn = new WeakMap<object, Set<ExecutionKey>>();

/**
 * The key of the execution `info` is in: its variable values, which graphql builds once per
 * execution. Every root field of an execution numbers its consumers alike, so they share rows.
 */
export function executionKey(info: GraphQLResolveInfo): ExecutionKey {
  return info.variableValues as object as ExecutionKey;
}

/**
 * Records that `info`'s execution planned `rows`, rows or a row the plugin loaded for it. Rows a
 * resolver runs itself are planned in the execution that reads them first.
 */
export function markPlanned<T>(rows: T, info: GraphQLResolveInfo): T {
  const execution = executionKey(info);
  for (const row of Array.isArray(rows) ? rows : [rows]) {
    if (row !== null && typeof row === 'object') {
      let executions = plannedIn.get(row);
      if (!executions) {
        executions = new Set();
        plannedIn.set(row, executions);
      }
      executions.add(execution);
    }
  }
  return rows;
}

/** Gives the rows in `value` without executions of their own the set `executions`. */
function share(value: unknown, executions: Set<ExecutionKey>) {
  if (Array.isArray(value)) {
    for (const row of value) {
      share(row, executions);
    }
  } else if (value !== null && typeof value === 'object' && !plannedIn.has(value)) {
    plannedIn.set(value, executions);
  }
}

/** The copies of each row or type copy, by the consumer they lift. */
const copies = new WeakMap<object, Map<string, object>>();

/**
 * The `combine()` values on `row`, an ORM row of `model`: what its to-many relation keys hold
 * unless they hold an array. Read once per row, by the execution keyed `execution`, which a row no
 * execution marked planned (see `markPlanned`) is then planned in. The rows beneath it share its
 * executions, and are read when the field returning them resolves.
 */
function slotsOf(row: object, model: PrismaNextModel, execution: ExecutionKey): Slots {
  let slots = parsed.get(row);
  if (slots) {
    return slots;
  }
  let executions = plannedIn.get(row);
  if (!executions) {
    executions = new Set([execution]);
    plannedIn.set(row, executions);
  }
  let relations: Record<string, RelationSlots> | undefined;
  let consumers: Set<string> | undefined;
  for (const name in model.relations) {
    const value = (row as Row)[name];
    if (!value || typeof value !== 'object') {
      continue;
    }
    if (!model.relations[name]!.isToMany || Array.isArray(value)) {
      share(value, executions);
      continue;
    }
    const slots: RelationSlots = { rows: {}, values: {}, own: {} };
    relations ??= {};
    relations[name] = slots;
    consumers ??= new Set();
    for (const [branch, loaded] of Object.entries(value)) {
      const { ids, key } = parseBranch(branch);
      for (const id of ids) {
        consumers.add(id);
        if (key !== undefined) {
          const values = isFieldOnlyKey(key) ? slots.own : slots.values;
          values[id] ??= {};
          values[id][key] = loaded;
        } else {
          slots.rows[id] = loaded;
          share(loaded, executions);
        }
      }
    }
  }
  slots = relations ? { relations, consumers: consumers! } : NO_SLOTS;
  parsed.set(row, slots);
  return slots;
}

/**
 * Writes what consumer `id` loaded onto `target`: its rows on the relation's key, and its computed
 * values but those only its field reads.
 */
function lift(target: Row, { relations }: Slots, id: string) {
  for (const name of Object.keys(relations)) {
    const { rows, values } = relations[name]!;
    if (Object.hasOwn(rows, id)) {
      target[name] = rows[id];
    }
    Object.assign(target, values[id]);
  }
}

/** The ORM row `value` is a copy of, or `value`. */
export function rowOf(value: object): object {
  return (value as Holder)[SLOTS]?.row ?? value;
}

/** The field a copy is made for: its consumer id and the position it was planned at. */
interface CopyField {
  readonly id: string;
  readonly position: Position;
}

/** How `copyWith` copies a row of `model`. */
interface CopyOptions {
  readonly model: PrismaNextModel;
  /** The relations whose rows a nested `select` of the consumer wrote branches on. */
  readonly nested: NestedPlan;
  /** For a field's copy, the field. */
  readonly field?: CopyField;
  /** For a copy of a row beneath a nested `select`, the id of that `select`. */
  readonly nestedIn?: string;
  /** The key of the execution the copy is made in (see `executionKey`). */
  readonly execution: ExecutionKey;
}

/**
 * A copy of `base` with what consumer `id` loaded written onto it, cached per base and id so
 * per-row caches such as scope-auth's see one object. A copy of the ORM row itself leaves out the
 * `combine()` values its relation keys hold.
 */
function copyWith(
  base: object,
  row: object,
  slots: Slots,
  id: string,
  { model, nested, field, nestedIn, execution }: CopyOptions,
) {
  let byId = copies.get(base);
  if (!byId) {
    byId = new Map();
    copies.set(base, byId);
  }
  let copy = byId.get(id) as Row | undefined;
  if (!copy) {
    copy = copyOf(base, base === row ? (key) => Object.hasOwn(slots.relations, key) : undefined);
    lift(copy, slots, id);
    if (field) {
      writePages(copy, slots, field);
    }
    liftNested(copy, model, id, nested, execution);
    const owner = field?.id ?? nestedIn;
    (copy as Holder)[SLOTS] = { row, slots, ...(owner === undefined ? {} : { field: owner }) };
    byId.set(id, copy);
  }
  return copy;
}

/**
 * Replaces the rows of each relation in `plan` on `copy`, a copy for consumer `id`, with copies
 * holding what its nested `select` loaded. Like a field's copy, such a copy is made again from its
 * row for any other reader.
 */
function liftNested(
  copy: Row,
  model: PrismaNextModel,
  id: string,
  plan: NestedPlan,
  execution: ExecutionKey,
) {
  const inner = nestedId(id);
  for (const [name, nested] of plan) {
    const target = model.relations[name]!.target;
    const copyRow = (value: unknown): unknown => {
      if (Array.isArray(value)) {
        return value.map(copyRow);
      }
      if (value === null || typeof value !== 'object') {
        return value;
      }
      const row = rowOf(value);
      return copyWith(row, row, slotsOf(row, target, execution), inner, {
        model: target,
        nested,
        nestedIn: inner,
        execution,
      });
    };
    if (copy[name] !== undefined) {
      copy[name] = copyRow(copy[name]);
    }
  }
}

/**
 * The parent every reader of a row of `model` sees: for an ORM row with `combine()` values, a copy
 * without them, holding them under `SLOTS`, with what the type-level selects loaded written on.
 * The type-level selects of a model agree, which the schema build checks (see
 * `assertSelectsAgree` in index.ts), so one copy serves every type. A copy holding `SLOTS`, this
 * plugin's or another plugin's copy of it, is the parent as it is, but a field's copy is made again
 * from its row. The type's branches are the same in every execution, so any execution reads them.
 * `execution` is the key of the execution (see `executionKey`).
 */
export function typeCopy(
  value: object,
  model: PrismaNextModel,
  nested: NestedPlan,
  execution: ExecutionKey,
) {
  const held = (value as Holder)[SLOTS];
  if (held && !held.field) {
    return value;
  }
  const row = held ? held.row : value;
  const slots = held ? held.slots : slotsOf(row, model, execution);
  return slots === NO_SLOTS && !nested.size
    ? row
    : copyWith(row, row, slots, TYPE_CONSUMER, { model, nested, execution });
}

/**
 * The parent of a field planned at `position`: the type's, with what the field's consumer loaded
 * written onto a copy of it, which only the field's resolver and the plugins after this one see.
 * Undefined when the field planned rows or values of its own that the parent doesn't hold, as when
 * a resolver returned rows another field planned, so the parent is reloaded. Branches another
 * execution's plan loaded aren't the parent's: their consumer ids may name other consumers.
 */
export function fieldCopy(
  value: object,
  model: PrismaNextModel,
  typeNested: NestedPlan,
  position: Position,
  execution: ExecutionKey,
): object | undefined {
  const base = typeCopy(value, model, typeNested, execution);
  const held = (base as Holder)[SLOTS];
  const id = consumerId(position);
  const nested = plannedNested.get(position);
  const foreign =
    held !== undefined && held.slots.consumers.size > 0 && !plannedIn.get(held.row)?.has(execution);
  if (foreign || !held?.slots.consumers.has(id)) {
    // A load of a whole relation, and a to-one relation's row, sit on the row unbranched, where
    // any field loading them reads them.
    const row = (held?.row ?? base) as Row;
    for (const [name, beneath] of ownLoads.get(position) ?? []) {
      if (!beneath || held?.slots.relations[name] || !holds(row[name], beneath)) {
        return undefined;
      }
    }
    if (!plannedPages.has(position) && !nested) {
      return base;
    }
    if (foreign) {
      return undefined;
    }
  }
  return copyWith(base, held?.row ?? base, held?.slots ?? NO_SLOTS, id, {
    model,
    nested: nested ?? NO_NESTED,
    field: { id, position },
    execution,
  });
}

/** The to-one relations a load includes beneath its rows, each with those beneath it. */
type ToOneLoads = ReadonlyMap<string, ToOneLoads>;

/** The to-one relations `selection` includes, as keyed by their names. */
function toOneLoads({ relations = {} }: PrismaNextSelection): ToOneLoads {
  return new Map(
    Object.entries(relations)
      .filter(([key]) => relationName(key) === key)
      .map(([key, child]) => [key, toOneLoads(child)]),
  );
}

/** Whether `value`, a relation's rows or row, holds the to-one relations `loads` includes. */
function holds(value: unknown, loads: ToOneLoads): boolean {
  if (value === undefined) {
    return false;
  }
  if (value === null || loads.size === 0) {
    return true;
  }
  if (Array.isArray(value)) {
    for (const row of value) {
      if (!holds(row, loads)) {
        return false;
      }
    }
    return true;
  }
  for (const [name, beneath] of loads) {
    if (!holds((value as Row)[name], beneath)) {
      return false;
    }
  }
  return true;
}

/**
 * The relations each field loads rows or computed values of: for a load of the relation's whole
 * rows, or a to-one relation's row, the to-one relations it includes beneath them, which rows
 * another plan loaded may lack. `false` for any other load.
 */
const ownLoads = new WeakMap<Position, ReadonlyMap<string, ToOneLoads | false>>();

/** Records what `selection`, the selection of the field at `position`, loads of its own. */
export function registerOwnLoads(position: Position, selection: PrismaNextSelection) {
  const id = consumerId(position);
  let loads: Map<string, ToOneLoads | false> | undefined;
  // A to-one relation is keyed by its name. A field planning fields beneath it on its parent's
  // row, as `t.variant` does, also returns their branches, which aren't its own.
  const add = (key: string, child?: PrismaNextSelection) => {
    const name = relationName(key);
    if (name === key || consumerOfKey(key) === id) {
      const whole = child && (name === key || loadsWholeRelation(child)) && toOneLoads(child);
      loads ??= new Map();
      loads.set(name, loads.get(name) === false ? false : (whole ?? false));
    }
  };
  for (const [key, child] of Object.entries(selection.relations ?? {})) {
    add(key, child);
  }
  for (const key of Object.keys(selection.computed ?? {})) {
    add(key);
  }
  if (loads) {
    ownLoads.set(position, loads);
  }
}

/** The relations whose rows the nested `select`s of each field's `select` wrote branches on. */
const plannedNested = new WeakMap<Position, NestedPlan>();

/**
 * Where a page's rows hold how it was planned (see `connectionPaging` in connections.ts), so the
 * page is built from the rows alone.
 */
export const PAGE = Symbol('prismaNextPage');

/** What a page's rows hold under `PAGE`: its plan, and its count when one was loaded. */
export interface PageData {
  readonly plan: unknown;
  readonly count: number | undefined;
}

/** The plans of the pages each field planned, by relation. */
const plannedPages = new WeakMap<Position, Map<string, unknown>>();

/** Records the plan of the page of relation `name` that the field at `position` loads. */
export function registerPage(position: Position, name: string, plan: unknown) {
  let pages = plannedPages.get(position);
  if (!pages) {
    pages = new Map();
    plannedPages.set(position, pages);
  }
  pages.set(name, plan);
}

/**
 * Writes the pages the field planned onto its copy: each relation's rows, or none when only its
 * count loaded, as an array holding the plan and count under `PAGE`.
 */
function writePages(copy: Row, { relations }: Slots, { id, position }: CopyField) {
  for (const [name, plan] of plannedPages.get(position) ?? []) {
    const loaded = relations[name];
    const rows = loaded && Object.hasOwn(loaded.rows, id) ? (loaded.rows[id] as unknown[]) : [];
    const count = loaded?.own[id]?.[COUNT_SLOT] as number | undefined;
    copy[name] = Object.assign([...rows], { [PAGE]: { plan, count } satisfies PageData });
  }
}

/**
 * The value `key`, only its field reads, that the consumer of `parent`, a field's copy, computed
 * from relation `name`.
 */
export function fieldValue(parent: object, name: string, key: string): unknown {
  const held = (parent as Holder)[SLOTS];
  return held?.field && held.slots.relations[name]?.own[held.field]?.[key];
}

/**
 * `loaded`, a row a reload returned, with the keys of `row`, the parent it reloads, that aren't
 * columns or relations of `model` or values this plugin wrote, such as keys another plugin's copy
 * added. It is copied only when there are such keys.
 */
export function withOtherKeys(loaded: Row, row: object, model: PrismaNextModel): Row {
  const relations = Object.values((row as Holder)[SLOTS]?.slots.relations ?? {});
  const written = (key: string) =>
    relations.some(({ values }) =>
      Object.values(values).some((computed) => Object.hasOwn(computed, key)),
    );
  let next: Row | undefined;
  for (const key of Object.keys(row)) {
    if (!isModelKey(model, key) && !written(key)) {
      next ??= copyOf(loaded);
      next[key] = (row as Row)[key];
    }
  }
  return next ?? loaded;
}

/** Whether `key` is a column or relation of `model`. */
function isModelKey(model: PrismaNextModel, key: string): boolean {
  return (
    model.columns.has(key) ||
    Object.hasOwn(model.relations, key) ||
    model.sharedVariantRelations.has(key)
  );
}

/**
 * Copies a row into a writable object with the same prototype and type brand, without the keys
 * `skip` names.
 */
function copyOf(row: object, skip?: (key: string) => boolean): Row {
  const copy = Object.create(Object.getPrototypeOf(row)) as Row;
  if (skip) {
    for (const key of Object.keys(row)) {
      if (!skip(key)) {
        copy[key] = (row as Row)[key];
      }
    }
  } else {
    Object.assign(copy, row);
  }
  const brand = getTypeBrand(row);
  if (brand) {
    brandWithType(copy, brand);
  }
  return copy;
}

/**
 * The relation entries of the type-level `select`s of the type's model whose nested `select`
 * writes branches on the relation's rows.
 */
export function typeNested(type: {
  readonly extensions?: Readonly<Record<string, unknown>> | null;
}): NestedPlan {
  return (type.extensions?.[PRISMA_NEXT_TYPE_NESTED] as NestedPlan | undefined) ?? NO_NESTED;
}

/** Records the relations whose rows the nested `select`s of the field at `position` write on. */
export function registerNested(position: Position, plan: NestedPlan | undefined) {
  if (plan) {
    plannedNested.set(position, plan);
  }
}
