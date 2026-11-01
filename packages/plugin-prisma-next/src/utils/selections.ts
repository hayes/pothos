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
import { variantForRelationType } from './contract.js';
import { getModel, type PrismaNextModel, type PrismaNextRelation } from './model.js';

/*
 * Scopes and slot keys
 *
 * A scope names one consumer of a to-many relation. A field's scope is `Type.alias`, joined with
 * `/` beneath the scopes of the fields above it (`Query.users/User.posts`). A type-level `select`
 * uses the type's name as its scope. Type names have no dot, so the two kinds never collide.
 *
 * In a query, a to-many relation and its computed values are keyed `relation:scope`, so each
 * consumer gets its own `combine()` slot. In the combined value the ORM returns, a consumer's rows
 * are keyed `scope` and its computed values `scope:key`.
 */

export const REFINE = Symbol('prismaNextRefine');
export const COMPUTE = Symbol('prismaNextCompute');

type Refine = (rel: MapperCollection) => MapperCollection | null | undefined;
/** Computes values from a to-many relation's collection. They are written onto the parent row. */
type Compute = (rel: MapperCollection, ctx: object) => Record<string, unknown>;

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
  query?: unknown;
  variant?: Narrowing;
  [REFINE]?: Refine;
}

export interface ComputedSelection {
  /** Identifies the computed values, like `RelationArgs.query`. */
  query: unknown;
  [COMPUTE]: Compute;
}

/**
 * A selection on one model. Planned node trees are written back in the same shape. A to-one
 * relation is keyed by its name because the ORM includes it once, so its consumers must agree on
 * it. A to-many relation and its computed values are keyed `relation:scope`. Consumers with
 * different arguments then get separate `combine()` slots and still load in one statement.
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
 * The scope of the field selected at `position`. A resolver reaches the same position through its
 * loader mapping, so it reads the slots its selection was planned into.
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

/** The query key a consumer at `scope` uses for a to-many relation or its computed values. */
function slotKey(relation: string, scope: string) {
  return `${relation}${SLOT}${scope}`;
}

function relationKey(relation: PrismaNextRelation, name: string, scope: string) {
  return relation.isToMany ? slotKey(name, scope) : name;
}

/** The relation a query key refers to. */
export function relationName(key: string) {
  const separator = key.indexOf(SLOT);
  return separator < 0 ? key : key.slice(0, separator);
}

/** A type-level select's scope is the type's name, which has no dot. */
function isTypeScope(scope: string) {
  return !scope.includes('.');
}

interface Combined {
  /** The combined value of each to-many relation loaded through `combine()`, by relation name. */
  slots: Record<string, Record<string, unknown>>;
  /** Every scope that has a slot on the row. */
  scopes: Set<string>;
  /** The scopes written back onto the row. Null when the row is frozen and was left as returned. */
  lifted: readonly string[] | null;
}

/** The combined relations taken off each row a statement returned. */
const combined = new WeakMap<object, Combined>();
/** Each row's views, keyed by the scopes they show. */
const views = new WeakMap<object, Map<string, object>>();
/** The row each view was made from. */
const viewRows = new WeakMap<object, object>();

/**
 * Moves the `combine()` slots off the rows a statement returned. A to-many relation loaded through
 * `combine()` comes back as an object with one slot per consumer scope, and `scopedView` gives each
 * reader the slots of its own scopes. When exactly one type-level select loaded slots on a row,
 * its rows and computed values are written back under their own keys. A reader that bypasses the
 * plugin's resolvers then sees the shape that type selected.
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
      // Rows are keyed by scope and computed values by `scope:key`.
      const scope = relationName(key);
      if (scope === key) {
        materializeRows(slot, relation.target);
      }
      entry.scopes.add(scope);
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
    const typeScopes = [...entry.scopes].filter(isTypeScope);
    entry.lifted = typeScopes.length === 1 ? typeScopes : [];
    lift(row, entry, entry.lifted);
  }
}

/** Writes the rows and computed values that `scopes` loaded onto `target`. Later scopes win. */
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
export function rowOfView<T>(value: T): T {
  return (viewRows.get(value as object) as T | undefined) ?? value;
}

/**
 * The row as a reader at `scopes` sees it. `value` may be the row or another view of it. The view
 * has the row's columns and each to-many relation and computed value as those scopes loaded it,
 * with later scopes winning. A relation those scopes did not load is absent. Views are cached per
 * row and set of scopes, so per-row caches such as scope-auth's see a single parent object. When
 * the row already holds what those scopes loaded, the row itself is returned.
 */
export function scopedView(value: object, scopes: readonly (string | undefined)[]): object {
  const row = rowOfView(value);
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
    // Start from the columns alone, without what was written back onto the row.
    const copy = copyOf(row) as Record<string, unknown>;
    for (const name of Object.keys(entry.slots)) {
      delete copy[name];
    }
    for (const scope of lifted ?? []) {
      const prefix = `${scope}${SLOT}`;
      for (const slots of Object.values(entry.slots)) {
        for (const key of Object.keys(slots)) {
          if (key.startsWith(prefix)) {
            delete copy[key.slice(prefix.length)];
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

/** Copies a row, which may be frozen, into a writable object with the same type brand. */
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

interface DeclarativeQuery {
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

/** Returns `value` if it is a declarative query with at least one option set. */
export function definedQuery(value: unknown): DeclarativeQuery | undefined {
  return isDeclarative(value) && Object.values(value).some((option) => option !== undefined)
    ? value
    : undefined;
}

/**
 * A `where` option as the ORM takes it. A callback written as `(model, args, ctx, tools)` is
 * adapted to the ORM's `(model, tools)`.
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

/**
 * The args of a relation load. `query` identifies the load and `refine` applies it to the
 * relation's collection. `variant` narrows a relation typed as a variant of its target.
 */
export function relationArgs(
  relation: PrismaNextRelation,
  {
    query,
    refine,
    variant,
  }: {
    query: unknown;
    refine: ((rel: MapperCollection) => MapperCollection) | undefined;
    variant?: string;
  },
): RelationArgs {
  const target = relation.targetVariantModel;
  const narrowing: Narrowing | undefined = target
    ? { value: target.value, throughVariantModel: true }
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

/** The values a consumer at `scope` computes from relation `name`. `query` identifies them. */
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

export function toOneFunctionMessage(owner: string, name: string) {
  return `select on '${owner}': the function form of to-one relation '${name}' requires combine(), which the ORM supports only for to-many relations. Use a relation field with query options or a declarative select instead.`;
}

function shapeError(owner: string, key: string, problem: string) {
  return new PothosValidationError(
    `select: '${key}' ${problem} on ${owner}. Use \`true\`, \`{ where?, orderBy?, limit?, offset? }\`, or a function \`(sub) => ({ key: value })\` for a relation.`,
  );
}

interface SelectScope {
  scope: string;
  args: object;
  /** Identifies the select's function entries, together with `args`. */
  source: unknown;
  /**
   * Plans the rows a relation entry loads, starting from `seed`. A field plans them beneath its
   * own selection. A type-level select includes them as they are.
   */
  rows(relation: PrismaNextRelation, seed: PrismaNextQuery): MaybePromise<PrismaNextQuery>;
}

/** Compiles a `select` object or column list. Each relation entry is one consumer at `scope`. */
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
      if (!relation.isToMany) {
        throw new PothosValidationError(toOneFunctionMessage(owner, name));
      }
      return computedSelection(name, scope, { source, args }, (sub, ctx) => {
        const values = (
          value as (sub: MapperCollection, args: object, ctx: object) => Record<string, unknown>
        )(sub, args, ctx);
        // Computed values are written onto the parent row, so they can't reuse its field names.
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
        args: relationArgs(relation, {
          query,
          refine: query && ((rel) => applyQuery(rel, query)),
        }),
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

/** Compiles a type-level `select`. Its relations load every column, in the type's own slots. */
export function compileTypeSelect(raw: RawSelect, model: PrismaNextModel, typeName: string) {
  return compileSelect(raw, model, typeName, {
    scope: typeName,
    args: {},
    source: typeName,
    rows: (_relation, seed) => seed,
  }) as PrismaNextQuery;
}

/**
 * Compiles a field's `select` for the planner. A select of columns alone becomes a static query.
 * Anything else becomes a select function that plans each relation entry as a consumer at the
 * field's position.
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
        // A field that returns another model has a selection set that can't load from these rows.
        if (returnModel && returnModel !== relation.target) {
          return seed;
        }
        // A relation to a hierarchy's base, typed as one of its variants, loads that variant.
        const variant = variantForRelationType(
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
