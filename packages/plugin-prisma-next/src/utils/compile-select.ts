import { completeValue, isThenable, type MaybePromise } from '@pothos/core';
import type {
  NestedSelection,
  PathSegment,
  Position,
  SelectedFieldNode,
} from '@pothos/selection-mapper';
import { getNamedType, isObjectType } from 'graphql';
import { PRISMA_NEXT_MODEL, PRISMA_NEXT_TYPE_SELECTS } from '../constants.js';
import { PrismaNextInterfaceRef } from '../interface-ref.js';
import { PrismaNextObjectRef } from '../object-ref.js';
import type { AnyContract } from '../types/models.js';
import type { MapperCollection } from './adapter.js';
import { rowsKey, valueKey } from './branch-keys.js';
import { consumerId, nestedId, TYPE_CONSUMER } from './consumers.js';
import { variantForRelationType } from './contract.js';
import { type OrderByDecl, orderCollection, orderColumns } from './cursors.js';
import { checkReturned } from './errors.js';
import {
  getModel,
  ownTableVariantRowsError,
  type PrismaNextModel,
  type PrismaNextRelation,
  returnsRelationRowsAs,
  sharedVariantRelationError,
} from './model.js';
import { type NestedPlan, NO_NESTED, registerNested } from './row-copies.js';
import {
  COMPUTE,
  type Compute,
  type Narrowing,
  type PrismaNextSelectFn,
  type PrismaNextSelection,
  REFINE,
  type Refine,
  type RelationArgs,
} from './selections.js';

/** Marks a field `select` entry that loads a connection helper's page of a to-many relation. */
export const CONNECTION_PAGE = Symbol('prismaNextConnectionPage');

/** Marks the relation of a connection helper's `select` that holds the nodes. */
export const NODE_SELECTION = Symbol('prismaNextNodeSelection');

/** The field a `select` function was invoked for, which a page entry plans beneath. */
interface FieldPlanning {
  /** The consumer id of the field's position (see `consumerId`). */
  id: string;
  nested: NestedSelection<PrismaNextSelection>;
  selected: SelectedFieldNode;
  position: Position;
}

/** Plans the page a `select` entry loads from relation `name`. */
export type PlanPage = (
  relation: PrismaNextRelation,
  name: string,
  field: FieldPlanning,
) => MaybePromise<PrismaNextSelection>;

function isPageEntry(value: unknown): value is { [CONNECTION_PAGE]: PlanPage } {
  return typeof value === 'object' && value !== null && CONNECTION_PAGE in value;
}

/** Marks a field `select` entry from `nestedSelection`. */
export const NESTED_SELECTION = Symbol('prismaNextNestedSelection');

/** What a `nestedSelection` entry plans: the relation's rows, as `type` at `path` beneath the field. */
export interface NestedEntry {
  query?: unknown;
  path?: PathSegment[];
  type?: unknown;
}

/** The `nestedSelection` a field's select function is passed. */
export function nestedSelectionEntry({ query, path, type }: NestedEntry = {}) {
  return { [NESTED_SELECTION]: { query, path, type } as NestedEntry };
}

function isNestedEntry(value: unknown): value is { [NESTED_SELECTION]: NestedEntry } {
  return typeof value === 'object' && value !== null && NESTED_SELECTION in value;
}

/**
 * A relation entry as an object: the type its rows load as, which narrows them to a variant, the
 * query of its rows, and a `select` of what it loads beneath them.
 */
export interface RelationEntry {
  type?: { readonly name: string; readonly modelKey: string };
  query?: unknown;
  select?: RawSelect;
}

/**
 * A relation entry with a type or a nested `select`, which a bare ref is shorthand for as
 * `{ type: ref }`. A query never has a `type` or `select` key. Undefined for other entries.
 */
export function relationEntry(value: unknown): RelationEntry | undefined {
  if (value instanceof PrismaNextObjectRef || value instanceof PrismaNextInterfaceRef) {
    return { type: value };
  }
  return typeof value === 'object' && value !== null && ('select' in value || 'type' in value)
    ? (value as RelationEntry)
    : undefined;
}

/**
 * The relation entries of a split `select` whose nested `select` writes branches on the relation's
 * rows: a to-many relation, which may load in a branch, or a computed value. Undefined for none.
 */
export function nestedPlan(
  { relations }: SplitSelect,
  model: PrismaNextModel,
): NestedPlan | undefined {
  let plan: Map<string, NestedPlan> | undefined;
  for (const [name, value] of relations) {
    const select = relationEntry(value)?.select;
    if (select) {
      const target = model.relations[name]!.target;
      const split = splitSelect(select, target);
      const inner = nestedPlan(split, target);
      if (
        inner ||
        split.computed.length ||
        split.relations.some(([key]) => target.relations[key]!.isToMany)
      ) {
        plan ??= new Map();
        plan.set(name, inner ?? NO_NESTED);
      }
    }
  }
  return plan;
}

/**
 * Column names, or an object of columns (`true`), relations (`true`, a query, or a function that
 * refines the rows) and computed values (`{ relation: (collection) => value }`).
 */
export type RawSelect = readonly string[] | Record<string, unknown>;

/** A computed value of a `select`: `key: { relation: compute }`. */
interface ComputedEntry {
  key: string;
  relation: string;
  compute: Compute;
}

interface DeclarativeQuery {
  where?: unknown;
  orderBy?: OrderByDecl;
  limit?: number;
  offset?: number;
}

/**
 * A declarative query without the options that load nothing different, or undefined when none is
 * left: an undefined option, and a `where` or `orderBy` that is an empty object or list. The types
 * check its shape.
 */
export function definedQuery(value: unknown): DeclarativeQuery | undefined {
  if (!value) {
    return undefined;
  }
  const options = Object.entries(value);
  const kept = options.filter(
    ([, option]) =>
      option !== undefined &&
      !(typeof option === 'object' && Object.keys(option as object).length === 0),
  );
  if (!kept.length) {
    return undefined;
  }
  return (kept.length === options.length ? value : Object.fromEntries(kept)) as DeclarativeQuery;
}

/**
 * Applies `query` to the collection of `modelKey`'s rows. Its order is resolved once, as
 * `orderColumns` resolves it: a literal's is checked when the schema is built, so by default only a
 * computed column fails here.
 */
export function queryRefinement(
  contract: AnyContract,
  modelKey: string,
  { where, orderBy, limit, offset }: DeclarativeQuery,
  problem?: Parameters<typeof orderColumns>[3],
) {
  const order = orderBy && orderColumns(contract, modelKey, orderBy, problem);
  return (collection: MapperCollection) => {
    let result = collection;
    if (where !== undefined) {
      result = result.where(where);
    }
    if (order?.length) {
      result = orderCollection(result, order);
    }
    if (limit !== undefined) {
      result = result.limit(limit);
    }
    if (offset !== undefined) {
      result = result.offset(offset);
    }
    return result;
  };
}

/**
 * How `value`, a relation entry or the `query` of a relation's rows, loads the rows of `modelKey`:
 * a function refines them and is identified by `identify`, a declarative query refines them and
 * identifies itself, and anything else, such as `true`, loads them whole. Without `identify`, a
 * function's load has no identity.
 */
export function relationLoad(
  contract: AnyContract,
  modelKey: string,
  value: unknown,
  problem?: Parameters<typeof orderColumns>[3],
  identify?: (refine: Refine) => unknown,
) {
  if (typeof value === 'function') {
    const refine = value as (rel: MapperCollection) => MapperCollection;
    return { loadIdentity: identify?.(refine), refine };
  }
  const query = definedQuery(value);
  return {
    loadIdentity: query as unknown,
    refine: query && queryRefinement(contract, modelKey, query, problem),
  };
}

/**
 * The args of a relation load. `loadIdentity` identifies the load and `refine` applies it to the
 * relation's collection. `variant` narrows a relation typed as a variant of its target.
 */
export function relationArgs(
  relation: PrismaNextRelation,
  {
    loadIdentity,
    refine,
    variant,
  }: {
    loadIdentity: unknown;
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
    ...(loadIdentity === undefined ? {} : { loadIdentity }),
    ...(narrowing ? { variant: narrowing } : {}),
    ...(refine ? { [REFINE]: refine } : {}),
  };
}

/** The rows of `relation` consumer `id` loads, with what is planned beneath them. */
export function rowsSelection(
  relation: PrismaNextRelation,
  name: string,
  id: string,
  child: MaybePromise<PrismaNextSelection>,
): MaybePromise<PrismaNextSelection> {
  return completeValue(child, (resolved) => ({
    relations: { [relation.isToMany ? rowsKey(name, id) : name]: resolved },
  }));
}

/** The value consumer `id` computes from relation `name` under `key`, identified by `loadIdentity`. */
export function computedSelection(
  name: string,
  id: string,
  key: string,
  loadIdentity: unknown,
  compute: Compute,
): PrismaNextSelection {
  return {
    computed: { [valueKey(name, id, key)]: { key, loadIdentity, [COMPUTE]: compute } },
  };
}

/**
 * The columns, relations and computed values of a `select`. The types check its entries: a key
 * that isn't a column or relation holds a computed value, which reads one relation.
 */
export function splitSelect(raw: RawSelect, model: PrismaNextModel) {
  const columns: string[] = [];
  const relations: [string, unknown][] = [];
  const computed: ComputedEntry[] = [];
  const assertLoadable = (name: string) => {
    if (model.sharedVariantRelations.has(name)) {
      throw sharedVariantRelationError(`a select of model '${model.key}'`, name, model);
    }
  };
  for (const [key, value] of Array.isArray(raw)
    ? raw.map((column) => [column, true] as const)
    : Object.entries(raw)) {
    // A conditional entry can leave a key undefined, or null in what a select function returns.
    if (value == null) {
      continue;
    }
    if (model.relations[key]) {
      relations.push([key, value]);
    } else if (model.sharedVariantRelations.has(key)) {
      assertLoadable(key);
    } else if (typeof value === 'object') {
      const [relation, compute] = Object.entries(value)[0]! as [string, Compute];
      assertLoadable(relation);
      computed.push({ key, relation, compute });
    } else {
      columns.push(key);
    }
  }
  return { columns, relations, computed };
}

export type SplitSelect = ReturnType<typeof splitSelect>;

/** A type-level `select`, split, with the name of the type that declares it. */
export type TypeSelect = SplitSelect & { name: string };

/**
 * The `select`s of a type and of its interfaces, which `onTypeConfig` keeps to one model hierarchy.
 * The deepest interface comes first and the type itself last. None for a type without a model.
 */
export function typeSelects(type: {
  readonly extensions?: Readonly<Record<string, unknown>> | null;
}): readonly TypeSelect[] {
  return (type.extensions?.[PRISMA_NEXT_TYPE_SELECTS] as TypeSelect[] | undefined) ?? [];
}

/**
 * Whether a `select` entry loads the rows of `relation` through a variant model with a table of its
 * own, which can't read the columns it inherits. A page entry doesn't hand over rows loaded that
 * way.
 */
export function loadsOwnTableVariantRows(relation: PrismaNextRelation, value: unknown) {
  return !isPageEntry(value) && relation.targetVariantModel?.sharesTable === false;
}

interface SelectCompilation {
  contract: AnyContract;
  id: string;
  args: object;
  /** The request's context, which a nested entry's query function is called with. */
  ctx?: object;
  /**
   * The select function the entries came from. A function builds new entries on every call, so
   * it identifies their loads together with `args`. A static select's entries identify themselves.
   */
  source?: unknown;
  /** The field a field's `select` plans for. The types allow page and nested entries only there. */
  field?: FieldPlanning;
  /** The model of the field's type, which `nestedSelection`'s to-many relation rows narrow to. */
  returnModelKey?: string;
  /** The name and model of the type a nested entry names. */
  typeOf?: (type: unknown) => { name: string; model: string | undefined };
  /**
   * For the entries of a nested `select`, beneath a relation entry, what loads them, which begins
   * an error about them.
   */
  nested?: string;
}

/** Compiles a split `select`. Each relation entry is one consumer, `id`. */
function compileSelect(
  { columns, relations, computed }: SplitSelect,
  model: PrismaNextModel,
  compilation: SelectCompilation,
): MaybePromise<PrismaNextSelection> {
  const { contract, id, args, ctx, source, field, returnModelKey, typeOf, nested } = compilation;
  const identity = (entry: unknown) => (source === undefined ? entry : { source, args });
  const owner = field && `Field '${field.position.type.name}.${field.position.field.name}'`;
  // `true`, a declarative query, or a function refining the rows, narrowed to `variant`.
  const load = (relation: PrismaNextRelation, value: unknown, variant?: string) =>
    relationArgs(relation, {
      ...relationLoad(contract, relation.targetModel, value, undefined, identity),
      variant,
    });
  const parts = relations.map(([name, value]) => {
    const relation = model.relations[name]!;
    // Checked when the schema is built for a static `select`, and here for what a select function
    // returns, as for the entries of the field's own `select`.
    if (nested && loadsOwnTableVariantRows(relation, value)) {
      throw ownTableVariantRowsError(nested, name, relation);
    }
    if (isPageEntry(value)) {
      return value[CONNECTION_PAGE](relation, name, field!);
    }
    const entry = relationEntry(value);
    if (entry) {
      // A type of a variant of the relation's target narrows its rows to that variant.
      const variant =
        entry.type &&
        variantForRelationType(
          contract,
          owner ?? "A type's select",
          relation.targetModel,
          entry.type.modelKey,
        );
      if (!entry.select) {
        return rowsSelection(relation, name, id, {
          columns: null,
          args: load(relation, entry.query ?? true, variant),
        });
      }
      // The rows load whole, with what the nested `select` names as consumer `nestedId(id)`.
      const target = relation.target;
      const inner = compileSelect(splitSelect(entry.select, target), target, {
        ...compilation,
        id: nestedId(id),
        nested: nestedSubject(
          nested ??
            (field
              ? `The select of field '${field.position.type.name}.${field.position.field.name}' loads`
              : "A type's select loads"),
          name,
        ),
      });
      return rowsSelection(
        relation,
        name,
        id,
        completeValue(inner, (selection) => ({
          ...selection,
          columns: null,
          args: { ...load(relation, entry.query ?? true, variant), nestedSelect: true },
        })),
      );
    }
    if (!isNestedEntry(value)) {
      return rowsSelection(relation, name, id, { columns: null, args: load(relation, value) });
    }
    // The rows are planned as the field's type, or as `type` at `path` beneath it. Rows of a
    // to-many relation planned as a variant of its target, rather than at a path beneath, load
    // that variant.
    const { query, path, type } = value[NESTED_SELECTION];
    const named = type === undefined ? undefined : typeOf!(type);
    const variant =
      relation.isToMany && !path?.length
        ? variantForRelationType(
            contract,
            owner!,
            relation.targetModel,
            named ? named.model : returnModelKey,
          )
        : undefined;
    return completeOption(query ?? true, args, ctx!, (resolved) =>
      rowsSelection(
        relation,
        name,
        id,
        field!.nested(
          {
            columns: null,
            args: checkReturned(resolved, (q) => load(relation, q ?? true, variant)),
          },
          // The selection mapper reads a type only at a path, which is the field itself when empty.
          named ? (path ?? []) : path,
          named?.name,
        ),
      ),
    );
  });
  for (const { key, relation, compute } of computed) {
    parts.push(computedSelection(relation, id, key, identity(compute), compute));
  }
  const settled = parts.some(isThenable) ? Promise.all(parts) : (parts as PrismaNextSelection[]);
  return completeValue(settled, (resolved) => ({
    columns,
    relations: Object.assign({}, ...resolved.map((part) => part.relations)),
    computed: Object.assign({}, ...resolved.map((part) => part.computed)),
  }));
}

/**
 * Begins an error about an entry of the nested `select` of relation `name`, beneath the `select`
 * whose error `subject` begins.
 */
export function nestedSubject(subject: string, name: string) {
  return `${subject} the rows of relation '${name}', whose nested select loads`;
}

/** Compiles a type-level `select`. Its relations load every column, in the model's type branches. */
export function compileTypeSelect(
  contract: AnyContract,
  split: SplitSelect,
  model: PrismaNextModel,
) {
  return compileSelect(split, model, {
    contract,
    id: TYPE_CONSUMER,
    args: {},
  }) as PrismaNextSelection;
}

/** `option`, or what it returns for `args` and `ctx` when it's a function, passed to `next`. */
export function completeOption<T, R>(
  option: T | ((args: object, ctx: object) => MaybePromise<T>),
  args: object,
  ctx: object,
  next: (value: T) => R,
) {
  return completeValue(
    typeof option === 'function'
      ? (option as (args: object, ctx: object) => MaybePromise<T>)(args, ctx)
      : option,
    next,
  );
}

/**
 * Compiles a field's `select` for the planner. A select of columns alone becomes a static
 * selection. Anything else becomes a select function that plans each relation entry as a consumer
 * at the field's position. A select function is passed `nestedSelection`, whose entries plan the
 * relation's rows as the field's type.
 */
export function compileFieldSelect(
  contract: AnyContract,
  raw:
    | RawSelect
    | ((
        args: object,
        ctx: object,
        nestedSelection: typeof nestedSelectionEntry,
      ) => MaybePromise<RawSelect | null | undefined>),
  model: PrismaNextModel,
  typeOf: (type: unknown) => { name: string; model: string | undefined },
): PrismaNextSelection | PrismaNextSelectFn {
  if (typeof raw !== 'function') {
    // A static select is checked when the schema is built, so it is split once, here.
    const split = splitSelect(raw, model);
    if (split.relations.length === 0 && split.computed.length === 0) {
      return { columns: split.columns };
    }
    const plan = nestedPlan(split, model);
    return (args, ctx, nested, selected, position) => {
      const id = consumerId(position);
      const field: FieldPlanning = { id, nested, selected, position };
      registerNested(position, plan);
      return compileSelect(split, model, { contract, id, args, ctx, field });
    };
  }
  return (args, ctx, nested, selected, position) => {
    const id = consumerId(position);
    const field: FieldPlanning = { id, nested, selected, position };
    const returnType = getNamedType(position.field.type);
    const returnModelKey = returnType.extensions?.[PRISMA_NEXT_MODEL] as string | undefined;
    const select: SelectCompilation = {
      contract,
      id,
      args,
      ctx,
      source: raw,
      field,
      returnModelKey,
      typeOf,
    };
    // Compiled for a request, which may be the first to see what a select function returns.
    return completeValue(raw(args, ctx, nestedSelectionEntry), (value) =>
      checkReturned(value ?? {}, (returned) => {
        const split = splitSelect(returned, model);
        // Rows of a variant model with a table of its own load without the columns it inherits,
        // which an interface or union reads before any field reloads them. The plugin checks a
        // static select when the schema is built, so this catches what a select function returns.
        for (const [name, entry] of split.relations) {
          const relation = model.relations[name]!;
          if (
            loadsOwnTableVariantRows(relation, entry) &&
            !returnsRelationRowsAs(
              relation,
              isObjectType(returnType) ? 'Object' : 'Other',
              returnModelKey === undefined ? undefined : getModel(contract, returnModelKey),
            )
          ) {
            throw ownTableVariantRowsError(
              `The select of field '${position.type.name}.${position.field.name}' loads`,
              name,
              relation,
            );
          }
        }
        registerNested(position, nestedPlan(split, model));
        return compileSelect(split, model, select);
      }),
    );
  };
}
