import {
  brandWithType,
  completeValue,
  getTypeBrand,
  isThenable,
  type MaybePromise,
  PothosValidationError,
} from '@pothos/core';
import type { Position, SelectFn } from '@pothos/selection-mapper';
import { getNamedType } from 'graphql';
import { PRISMA_NEXT_MODEL } from '../constants.js';
import type { AnyContract } from '../types.js';
import type { MapperCollection } from './adapter.js';
import { relationVariant } from './contract.js';
import { getModel, type PrismaNextModel, type PrismaNextRelation } from './model.js';

export const REFINE = Symbol('prismaNextRefine');
export const COMPUTE = Symbol('prismaNextCompute');

export type Refine = (rel: MapperCollection) => MapperCollection | null | undefined;
/** Values computed from a to-many relation's collection, lifted onto the consumer's parent. */
export type Compute = (rel: MapperCollection, ctx: object) => Record<string, unknown>;

/**
 * The variant a level is narrowed to: by `.variant(value)` on the base collection, or by loading
 * through the variant model's own accessor (`viaModel`), which is already narrowed and has only
 * that variant's relations.
 */
export interface Narrowing {
  value: string;
  viaModel?: boolean;
}

/**
 * What a relation load is. Compared structurally, so equal queries share an include; the closure
 * applying it rides under a symbol, which the comparison skips.
 */
export interface RelationArgs {
  /** The refinement: a declarative query object, or the defining field with its arguments. */
  query?: unknown;
  variant?: Narrowing;
  [REFINE]?: Refine;
}

export interface ComputedSelection {
  /** Compared like `RelationArgs.query`. */
  query: unknown;
  [COMPUTE]: Compute;
}

/**
 * A selection on one model, and the node tree written back as one. A to-one relation is keyed by
 * its name: the ORM includes it once, so its consumers share it or conflict. A to-many relation
 * is keyed `relation:scope` (and computed values likewise): each consumer scope gets its own
 * `combine()` slot, so consumers with different arguments still load in one statement.
 */
export interface PrismaNextQuery {
  /** `null` selects every column. */
  columns?: readonly string[] | null;
  relations?: Record<string, PrismaNextQuery>;
  computed?: Record<string, ComputedSelection>;
  args?: RelationArgs;
}

export type PrismaNextSelectFn = SelectFn<PrismaNextQuery>;

export const EMPTY: PrismaNextQuery = Object.freeze({});

export const SLOT = ':';

const scopes = new WeakMap<Position, string>();

/**
 * The slot of the field selected at `position`: its type and alias, beneath the scopes of the
 * fields above it. A resolver finds the same position through its loader mapping, so it reads
 * exactly the slots its selection was planned into.
 */
export function scopeOf(position: Position): string {
  let scope = scopes.get(position);
  if (scope === undefined) {
    const own = `${position.type.name}.${position.node.alias?.value ?? position.node.name.value}`;
    scope = position.parent ? `${scopeOf(position.parent)}/${own}` : own;
    scopes.set(position, scope);
  }
  return scope;
}

/** The key of the slot `scope` reads a to-many relation or its computed values under. */
function slotKey(relation: string, scope: string) {
  return `${relation}${SLOT}${scope}`;
}

function relationKey(relation: PrismaNextRelation, name: string, scope: string) {
  return relation.isToMany ? slotKey(name, scope) : name;
}

export function relationName(key: string) {
  const separator = key.indexOf(SLOT);
  return separator < 0 ? key : key.slice(0, separator);
}

interface Combined {
  /** Each to-many relation loaded through `combine()`: its slots, by scope. */
  slots: Record<string, Record<string, unknown>>;
  /** Every scope with a slot. */
  scopes: Set<string>;
  /** The scopes lifted onto the row itself; null when the row was left as returned (frozen). */
  lifted: readonly string[] | null;
}

/** The combine slots of each statement row, which never stay on the row. */
const combined = new WeakMap<object, Combined>();
/** Each row's views, by the scopes lifted onto them. */
const views = new WeakMap<object, Map<string, object>>();
/** The row each view was made from. */
const viewRows = new WeakMap<object, object>();

/**
 * Takes the combine slots of the rows a statement returned off them. A to-many relation loaded
 * through `combine()` comes back as an object of slots, one per consumer scope; `viewOf` hands
 * each reader its own. A row whose slots belong to one type keeps that type's rows and computed
 * values under their own keys, so a reader outside the plugin's hooks sees that type's shape;
 * otherwise it keeps no value for the relation.
 */
export function materializeRows<T>(rows: T, model: PrismaNextModel): T {
  if (Array.isArray(rows)) {
    for (const row of rows) {
      materializeRows(row, model);
    }
  } else if (rows && typeof rows === 'object') {
    materializeRow(rows as Record<string, unknown>, model);
  }
  return rows;
}

function materializeRow(row: Record<string, unknown>, model: PrismaNextModel) {
  let entry: Combined | undefined;
  for (const name of Object.keys(model.relations)) {
    const relation = model.relations[name]!;
    const value = row[name];
    if (!value || typeof value !== 'object') {
      continue;
    }
    if (!relation.isToMany || Array.isArray(value)) {
      materializeRows(value, relation.target);
      continue;
    }
    entry ??= { slots: {}, scopes: new Set(), lifted: null };
    entry.slots[name] = value as Record<string, unknown>;
    for (const [key, slot] of Object.entries(value)) {
      const separator = key.indexOf(SLOT);
      if (separator < 0) {
        materializeRows(slot, relation.target);
      }
      entry.scopes.add(separator < 0 ? key : key.slice(0, separator));
    }
  }
  if (!entry) {
    return;
  }
  combined.set(row, entry);
  if (!Object.isFrozen(row)) {
    for (const name of Object.keys(entry.slots)) {
      delete row[name];
    }
    // A field's scope is `Type.alias`; a type-level select's is the type's name.
    const typeScopes = [...entry.scopes].filter((scope) => !scope.includes('.'));
    entry.lifted = typeScopes.length === 1 ? typeScopes : [];
    lift(row, entry, entry.lifted);
  }
}

/** Writes the rows and computed values `scopes` read onto `target`, later scopes winning. */
function lift(target: Record<string, unknown>, entry: Combined, scopes: readonly string[]) {
  for (const name of Object.keys(entry.slots)) {
    const slots = entry.slots[name]!;
    for (const scope of scopes) {
      const prefix = `${scope}${SLOT}`;
      for (const key of Object.keys(slots)) {
        if (key === scope) {
          target[name] = slots[key];
        } else if (key.startsWith(prefix)) {
          target[key.slice(prefix.length)] = slots[key];
        }
      }
    }
  }
}

/** The row a view was made from, or `value` itself. */
export function rowOf<T>(value: T): T {
  return (viewRows.get(value as object) as T | undefined) ?? value;
}

/**
 * What a reader at `scopes` sees of a row (or of another view of it): the row's columns, with
 * each to-many relation and computed value as those scopes loaded it, later scopes winning, and
 * nothing for a relation they didn't load. One object per row and set of scopes, so per-row
 * caches (scope-auth's) see one parent; the row itself when that is what it already holds.
 */
export function viewOf(value: object, scopes: readonly (string | undefined)[]): object {
  const row = rowOf(value);
  const entry = combined.get(row);
  if (!entry) {
    return row;
  }
  const present = scopes.filter(
    (scope): scope is string => scope !== undefined && entry.scopes.has(scope),
  );
  const { lifted } = entry;
  if (lifted && present.length === lifted.length && present.every((s, i) => s === lifted[i])) {
    return row;
  }
  let cache = views.get(row);
  if (!cache) {
    cache = new Map();
    views.set(row, cache);
  }
  const key = present.join(' ');
  let view = cache.get(key);
  if (!view) {
    const copy = copyOf(row) as Record<string, unknown>;
    for (const name of Object.keys(entry.slots)) {
      delete copy[name];
    }
    for (const scope of lifted ?? []) {
      for (const slots of Object.values(entry.slots)) {
        for (const slot of Object.keys(slots)) {
          if (slot.startsWith(`${scope}${SLOT}`)) {
            delete copy[slot.slice(scope.length + 1)];
          }
        }
      }
    }
    lift(copy, entry, present);
    viewRows.set(copy, row);
    cache.set(key, copy);
    view = copy;
  }
  return view;
}

/** A writable copy of a (possibly frozen) row's columns, keeping its type brand. */
function copyOf(row: object): object {
  const copy = Object.assign(Object.create(Object.getPrototypeOf(row)) as object, row);
  const brand = getTypeBrand(row);
  if (brand) {
    brandWithType(copy, brand);
  }
  return copy;
}

/** Column names, or an object of columns (`true`) and relations (`true`, a query, or a function). */
export type RawSelect = readonly string[] | Record<string, unknown>;

export interface DeclarativeQuery {
  where?: unknown;
  orderBy?: unknown;
  limit?: number;
  offset?: number;
}

const DECLARATIVE_KEYS = new Set(['where', 'orderBy', 'limit', 'offset']);

function isDeclarative(value: unknown): value is DeclarativeQuery {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length > 0 &&
    Object.keys(value).every((key) => DECLARATIVE_KEYS.has(key))
  );
}

/** A query with something in it, or undefined. */
export function definedQuery(value: unknown): DeclarativeQuery | undefined {
  return isDeclarative(value) && Object.values(value).some((option) => option !== undefined)
    ? value
    : undefined;
}

/**
 * A `where` option as the ORM takes it. A callback also receives the field's arguments and the
 * request context, before the ORM's tools.
 */
export function whereInput(where: unknown, args: object, ctx: object): unknown {
  return typeof where === 'function'
    ? (model: unknown, tools: unknown) =>
        (where as (model: unknown, args: object, ctx: object, tools: unknown) => unknown)(
          model,
          args,
          ctx,
          tools,
        )
    : where;
}

export function applyQuery(collection: MapperCollection, query: DeclarativeQuery) {
  let result = collection;
  if (query.where !== undefined) {
    result = result.where(query.where);
  }
  if (query.orderBy !== undefined) {
    result = result.orderBy(query.orderBy);
  }
  if (query.limit !== undefined) {
    result = result.limit(query.limit);
  }
  if (query.offset !== undefined) {
    result = result.offset(query.offset);
  }
  return result;
}

/** The arguments of a relation load: what identifies its query, its narrowing, how to apply it. */
export function relationArgs(
  relation: PrismaNextRelation,
  query: unknown,
  refine: ((rel: MapperCollection) => MapperCollection) | undefined,
  variant?: string,
): RelationArgs {
  const target = relation.targetVariant;
  const narrowing: Narrowing | undefined = target
    ? { value: target.value, viaModel: true }
    : variant === undefined
      ? undefined
      : { value: variant };
  return {
    ...(query === undefined ? {} : { query }),
    ...(narrowing ? { variant: narrowing } : {}),
    ...(refine ? { [REFINE]: refine } : {}),
  };
}

/** The rows of `relation` a consumer at `scope` loads, with what is planned beneath them. */
export function rowsSelection(
  relation: PrismaNextRelation,
  name: string,
  scope: string,
  child: MaybePromise<PrismaNextQuery>,
): MaybePromise<PrismaNextQuery> {
  return completeValue(child, (resolved) => ({
    relations: { [relationKey(relation, name, scope)]: resolved },
  }));
}

/** Values a consumer at `scope` computes from relation `name`; `query` identifies them. */
export function computedSelection(
  name: string,
  scope: string,
  query: unknown,
  compute: Compute,
): PrismaNextQuery {
  return { computed: { [slotKey(name, scope)]: { query, [COMPUTE]: compute } } };
}

/** The columns and relations of a `select`, without validating them. */
export function splitSelect(raw: RawSelect, model: PrismaNextModel | undefined) {
  const columns: string[] = [];
  const relations: [string, unknown][] = [];
  for (const [key, value] of Array.isArray(raw)
    ? raw.map((column) => [column, true] as const)
    : Object.entries(raw)) {
    if (value === false || value == null) {
      continue;
    }
    if (model?.relations[key]) {
      relations.push([key, value]);
    } else {
      columns.push(key);
    }
  }
  return { columns, relations };
}

function shapeError(owner: string, key: string, problem: string) {
  return new PothosValidationError(
    `select: '${key}' ${problem} on ${owner}. Use \`true\`, \`{ where?, orderBy?, limit?, offset? }\`, or a function \`(sub, args, ctx) => spec\` for a relation.`,
  );
}

interface SelectScope {
  scope: string;
  args: object;
  /** Identifies the function entries, with `args`. */
  source: unknown;
  /** The rows a relation entry loads from `seed`: planned beneath the field, or included bare. */
  rows(relation: PrismaNextRelation, seed: PrismaNextQuery): MaybePromise<PrismaNextQuery>;
}

/** A `select` object or column list, each relation entry as one consumer at `scope`. */
function compileSelect(
  raw: RawSelect,
  model: PrismaNextModel | undefined,
  owner: string,
  { scope, args, source, rows }: SelectScope,
): MaybePromise<PrismaNextQuery> {
  const { columns, relations } = splitSelect(raw, model);
  for (const column of Array.isArray(raw) ? [] : columns) {
    const value = (raw as Record<string, unknown>)[column];
    if (value !== true) {
      throw shapeError(
        owner,
        column,
        typeof value === 'function' || isDeclarative(value)
          ? 'is not a relation'
          : 'has an unrecognized value shape',
      );
    }
  }
  const parts = relations.map(([name, value]) => {
    const relation = model!.relations[name]!;
    if (typeof value === 'function') {
      return computedSelection(name, scope, { source, args }, (sub, ctx) => {
        const values = (
          value as (sub: MapperCollection, args: object, ctx: object) => Record<string, unknown>
        )(sub, args, ctx);
        // Computed values are lifted onto the parent row beside its columns and relations.
        const clash = Object.keys(values).find(
          (key) => model!.columns.has(key) || Object.hasOwn(model!.relations, key),
        );
        if (clash !== undefined) {
          throw new PothosValidationError(
            `select on ${owner}: '${name}' computes '${clash}', which is a column or relation of model ${model!.name}. Give the computed value another name.`,
          );
        }
        return values;
      });
    }
    if (value !== true && !isDeclarative(value)) {
      throw shapeError(owner, name, 'has an unrecognized value shape');
    }
    const query = value === true ? undefined : value;
    return rowsSelection(
      relation,
      name,
      scope,
      rows(relation, {
        columns: null,
        args: relationArgs(relation, query, query && ((rel) => applyQuery(rel, query))),
      }),
    );
  });
  const settled = parts.some(isThenable) ? Promise.all(parts) : (parts as PrismaNextQuery[]);
  return completeValue(settled, (resolved) => ({
    columns,
    relations: Object.assign({}, ...resolved.map((part) => part.relations)),
    computed: Object.assign({}, ...resolved.map((part) => part.computed)),
  }));
}

/** A type-level `select`: relations load every column, under the type's own slots. */
export function compileTypeSelect(raw: RawSelect, model: PrismaNextModel, typeName: string) {
  return compileSelect(raw, model, typeName, {
    scope: typeName,
    args: {},
    source: typeName,
    rows: (_relation, seed) => seed,
  }) as PrismaNextQuery;
}

/**
 * A field's `select` as the planner reads it: a static query for columns alone, otherwise a
 * select function planning each relation entry as a consumer at the field's position.
 */
export function compileFieldSelect(
  contract: AnyContract,
  raw: RawSelect | ((args: object, ctx: object) => MaybePromise<RawSelect | null | undefined>),
  model: PrismaNextModel | undefined,
  owner: string,
): PrismaNextQuery | PrismaNextSelectFn {
  if (typeof raw !== 'function') {
    const { columns, relations } = splitSelect(raw, model);
    if (
      relations.length === 0 &&
      (Array.isArray(raw) || columns.every((column) => raw[column as never] === true))
    ) {
      return { columns };
    }
  }
  return (args, ctx, nested, _selected, position) => {
    const returnModelKey = getNamedType(position.field.type).extensions?.[PRISMA_NEXT_MODEL] as
      | string
      | undefined;
    const returnModel =
      returnModelKey === undefined ? undefined : getModel(contract, returnModelKey);
    const select: SelectScope = {
      scope: scopeOf(position),
      args,
      source: raw,
      rows: (relation, seed) => {
        if (returnModel && returnModel !== relation.target) {
          return seed;
        }
        // A relation to a hierarchy's base, typed as one of its variants, loads that variant.
        const variant = relationVariant(
          contract,
          `Field '${position.field.name}'`,
          relation.targetModel,
          returnModelKey,
        );
        return nested(
          variant === undefined
            ? seed
            : { ...seed, args: { ...seed.args, variant: { value: variant } } },
        );
      },
    };
    return completeValue(typeof raw === 'function' ? raw(args, ctx) : raw, (value) =>
      compileSelect(value ?? {}, model, owner, select),
    );
  };
}
