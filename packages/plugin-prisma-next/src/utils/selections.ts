import {
  brandWithType,
  completeValue,
  getTypeBrand,
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
export function slotKey(relation: string, scope: string) {
  return `${relation}${SLOT}${scope}`;
}

export function relationKey(relation: PrismaNextRelation, name: string, scope: string) {
  return relation.isToMany ? slotKey(name, scope) : name;
}

export function relationName(key: string) {
  const separator = key.indexOf(SLOT);
  return separator < 0 ? key : key.slice(0, separator);
}

/**
 * What a consumer at `scope` reads from `row`: its rows of each to-many relation, and the values
 * it computed from one, over a copy of the row (so resolvers can spread or serialize it). The
 * row itself when nothing was combined.
 */
export function viewOf(
  row: object,
  toMany: readonly string[],
  ownScopes: readonly (string | undefined)[],
): object {
  let view: object | undefined;
  const define = (key: string, value: unknown) => {
    view ??= copyOf(row);
    Object.defineProperty(view, key, {
      value,
      enumerable: true,
      configurable: true,
      writable: true,
    });
  };
  for (const relation of toMany) {
    const slots = (row as Record<string, unknown>)[relation];
    if (!slots || typeof slots !== 'object' || Array.isArray(slots)) {
      continue;
    }
    for (const scope of ownScopes) {
      if (scope === undefined) {
        continue;
      }
      const prefix = `${scope}${SLOT}`;
      for (const key of Object.keys(slots)) {
        if (key === scope) {
          define(relation, (slots as Record<string, unknown>)[key]);
        } else if (key.startsWith(prefix)) {
          define(key.slice(prefix.length), (slots as Record<string, unknown>)[key]);
        }
      }
    }
  }
  return view ?? row;
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
      return computedSelection(name, scope, { source, args }, (sub, ctx) =>
        (value as (sub: MapperCollection, args: object, ctx: object) => Record<string, unknown>)(
          sub,
          args,
          ctx,
        ),
      );
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
  const settled = parts.some((part) => typeof (part as PromiseLike<unknown>).then === 'function')
    ? Promise.all(parts)
    : (parts as PrismaNextQuery[]);
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
