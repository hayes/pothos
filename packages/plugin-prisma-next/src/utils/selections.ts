import {
  brandWithType,
  completeValue,
  getTypeBrand,
  isThenable,
  type MaybePromise,
} from '@pothos/core';
import type {
  NestedSelection,
  Position,
  SelectedFieldNode,
  SelectFn,
} from '@pothos/selection-mapper';
import { type FieldNode, type GraphQLResolveInfo, getNamedType, isAbstractType } from 'graphql';
import { PRISMA_NEXT_MODEL } from '../constants.js';
import type { AnyContract } from '../types/models.js';
import type { MapperCollection } from './adapter.js';
import { variantForRelationType } from './contract.js';
import { type OrderByDecl, orderCollection, orderColumns } from './cursors.js';
import { InternalError } from './errors.js';
import {
  getModel,
  ownTableVariantRowsError,
  type PrismaNextModel,
  type PrismaNextRelation,
  sharedVariantRelationError,
} from './model.js';

/*
 * Consumers and branches
 *
 * A consumer is one reader of a to-many relation's rows or computed values. A field's consumer id
 * is a short number (`consumerId`). A type-level `select` uses its type's name, which never starts
 * with a digit, so the two kinds never collide.
 *
 * In a selection, a to-many relation and its computed values are keyed `relation:id`, so each
 * consumer gets its own `combine()` branch. A branch is named `n/ids` for rows and `n/ids:key` for
 * a computed value, where `n` is unique in the statement (see `combine` in adapter.ts) and `ids`
 * are the ids of the consumers sharing it, joined with a space.
 *
 * Rows stay as the ORM returned them. A field returning rows hands each one on as a copy for its
 * type (`typeCopy`): the `combine()` values come off the relation keys and go under `SLOTS`, and
 * what the type's selects loaded is written back on. A field with a select of its own reads a copy
 * of that with its own branches written on (`fieldCopy`).
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
  loadIdentity?: unknown;
  variant?: Narrowing;
  [REFINE]?: Refine;
}

export interface ComputedSelection {
  /** Identifies the computed values, like `RelationArgs.loadIdentity`. */
  loadIdentity: unknown;
  [COMPUTE]: Compute;
}

/**
 * A selection on one model. Planned node trees are written back in the same shape. A to-many
 * relation and its computed values are keyed `relation:id`. Consumers with different arguments
 * then get separate `combine()` branches and still load in one statement. A to-one relation is always
 * loaded whole and keyed by its name, so every reader of the row sees it there.
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

/** Marks a field `select` entry that loads a connection helper's page of a to-many relation. */
export const CONNECTION_PAGE = Symbol('prismaNextConnectionPage');

/** Marks the relation of a connection helper's `select` that holds the nodes. */
export const NODE_SELECTION = Symbol('prismaNextNodeSelection');

/** The field a `select` function was invoked for, which a page entry plans beneath. */
interface FieldPlanning {
  /** The consumer id of the field's position (see `consumerId`). */
  id: string;
  args: object;
  ctx: object;
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

/** Separates a relation from a consumer id in a selection key, and ids from a computed key. */
export const KEY_SEPARATOR = ':';
/** Joins the ids of consumers that share a branch. */
export const ID_SEPARATOR = ' ';

/**
 * The key a connection's count is computed under. A computed key that starts with
 * `KEY_SEPARATOR` stays in the consumer's branch, which the field reads, rather than going onto
 * the parent.
 */
export const COUNT_SLOT = `${KEY_SEPARATOR}count`;

/** The key `relationCount` computes its count under, which stays in its branch. */
export const VALUE_SLOT = `${KEY_SEPARATOR}value`;

/** The interned consumer ids of one operation. */
interface ConsumerIds {
  readonly ids: Map<string, string>;
  next: number;
}

/**
 * Per operation, not per request: an operation's response keys are its document's, so its table is
 * bounded by the document, while a context can be shared by any number of documents.
 */
const operationIds = new WeakMap<object, ConsumerIds>();
/** The operation of each field node a plan starts from, recorded by `registerPlanRoots`. */
const rootOperations = new WeakMap<FieldNode, object>();
const positionIds = new WeakMap<Position, { id: string; table: ConsumerIds }>();
/** A number per field definition: Pothos builds an inherited field from the interface's options. */
const definitionIds = new WeakMap<object, number>();
let nextDefinitionId = 0;

/**
 * Records the operation of the fields a plan for `info` starts from, which the consumers beneath
 * them are numbered in. Called by every entry point before it plans.
 */
export function registerPlanRoots(info: GraphQLResolveInfo) {
  for (const node of info.fieldNodes) {
    rootOperations.set(node, info.operation);
  }
}

/**
 * The id of the consumer selected at `position`: its parent consumer's id, the field's definition
 * and its response key, interned to a short number per operation. So:
 *
 * - The field nodes of one response key (fragments that each select it) share one consumer, as
 *   their resolver finds one mapping.
 * - An implementation that inherits a field unchanged shares the interface's consumer, and an
 *   override has its own.
 * - Reloads of one field at several paths number their consumers alike, so a batch merges them
 *   rather than loading one copy of everything beneath per path.
 *
 * Reads `walkParent`, never `parent`, so numbering a consumer never keeps a walk from being shared.
 * Beneath a shared walk, every place reads the first place's positions, and so do its resolvers.
 */
export function consumerId(position: Position): string {
  return consumerOf(position).id;
}

function consumerOf(position: Position): { id: string; table: ConsumerIds } {
  let consumer = positionIds.get(position);
  if (consumer) {
    return consumer;
  }
  const { field, node, walkParent } = position;
  const above = walkParent && consumerOf(walkParent);
  let table = above?.table;
  if (!table) {
    const operation = rootOperations.get(node)!;
    table = operationIds.get(operation);
    if (!table) {
      table = { ids: new Map(), next: 0 };
      operationIds.set(operation, table);
    }
  }
  const definition: object = field.extensions?.pothosOptions ?? field;
  let definitionId = definitionIds.get(definition);
  if (definitionId === undefined) {
    definitionId = nextDefinitionId;
    nextDefinitionId += 1;
    definitionIds.set(definition, definitionId);
  }
  const key = `${above?.id ?? ''}|${definitionId}.${node.alias?.value ?? node.name.value}`;
  let id = table.ids.get(key);
  if (id === undefined) {
    id = String(table.next);
    table.next += 1;
    table.ids.set(key, id);
  }
  consumer = { id, table };
  positionIds.set(position, consumer);
  return consumer;
}

/** The selection key a consumer uses for a to-many relation or its computed values. */
function slotKey(relation: string, id: string) {
  return `${relation}${KEY_SEPARATOR}${id}`;
}

/** Whether a relation load has every row of the relation, rather than a filtered or paged part. */
export function loadsWholeRelation({ args }: PrismaNextSelection) {
  return args?.loadIdentity === undefined && (!args?.variant || args.variant.throughVariantModel);
}

/** The relation a selection key refers to. */
export function relationName(key: string) {
  const separator = key.indexOf(KEY_SEPARATOR);
  return separator < 0 ? key : key.slice(0, separator);
}

type Row = Record<string, unknown>;

/** What the consumers of one to-many relation loaded through `combine()`, by consumer id. */
interface RelationSlots {
  readonly rows: Record<string, unknown>;
  readonly values: Record<string, Row>;
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
  /** The consumers whose branches were written onto the copy. */
  readonly lifted: ReadonlySet<string>;
  /** For a field's copy, the consumer it was made for and the position it was planned at. */
  readonly field?: { readonly id: string; readonly position: Position };
}

/**
 * Where a copy keeps its row's `combine()` values. An enumerable property, so `{ ...parent }` and
 * `Object.assign` copies other plugins make keep them, and are recognized by it. JSON and
 * structuredClone copies drop it.
 */
const SLOTS = Symbol('prismaNextSlots');

type Holder = { [SLOTS]?: Held };

const NO_SLOTS: Slots = Object.freeze({
  relations: Object.freeze({}),
  consumers: new Set<string>(),
});

/** What `slotsOf` read off each ORM row. */
const parsed = new WeakMap<object, Slots>();
/** The copies this plugin made, as opposed to copies of them other plugins made. */
const owned = new WeakSet<object>();
/** The copies of each row or type copy, by the consumers they lift. */
const copies = new WeakMap<object, Map<string, object>>();

/**
 * The `combine()` values on `row`, an ORM row of `model`: what its to-many relation keys hold
 * unless they hold an array. Read once per row. Nothing beneath the row is read: a row beneath is
 * read when the field returning it resolves.
 */
function slotsOf(row: object, model: PrismaNextModel): Slots {
  let slots = parsed.get(row);
  if (slots) {
    return slots;
  }
  let relations: Record<string, RelationSlots> | undefined;
  let consumers: Set<string> | undefined;
  for (const name in model.relations) {
    const value = (row as Row)[name];
    if (
      !model.relations[name]!.isToMany ||
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value)
    ) {
      continue;
    }
    const rows: Record<string, unknown> = {};
    const values: Record<string, Row> = {};
    relations ??= {};
    relations[name] = { rows, values };
    consumers ??= new Set();
    for (const [branch, loaded] of Object.entries(value)) {
      // `n/ids` or `n/ids:key`. The number only keeps the ORM's aliases apart.
      const named = branch.slice(branch.indexOf('/') + 1);
      const separator = named.indexOf(KEY_SEPARATOR);
      const ids = separator < 0 ? named : named.slice(0, separator);
      for (const id of ids.split(ID_SEPARATOR)) {
        consumers.add(id);
        if (separator < 0) {
          rows[id] = loaded;
        } else {
          values[id] ??= {};
          values[id][named.slice(separator + 1)] = loaded;
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
 * values but those whose key starts with `KEY_SEPARATOR`. A page counted without rows has none.
 */
function lift(target: Row, { relations }: Slots, id: string) {
  for (const name of Object.keys(relations)) {
    const { rows, values } = relations[name]!;
    const computed = values[id];
    if (Object.hasOwn(rows, id)) {
      target[name] = rows[id];
    } else if (computed?.[COUNT_SLOT] !== undefined) {
      target[name] = [];
    }
    for (const key of Object.keys(computed ?? {})) {
      if (!key.startsWith(KEY_SEPARATOR)) {
        target[key] = computed![key];
      }
    }
  }
}

/** The ORM row `value` is a copy of, or `value`. */
export function rowOf(value: object): object {
  return owned.has(value) ? (value as Holder)[SLOTS]!.row : value;
}

/**
 * A copy of `base` with what `ids` loaded written onto it, cached per base and ids so per-row
 * caches such as scope-auth's see one object.
 */
function copyWith(
  base: object,
  row: object,
  slots: Slots,
  lifted: ReadonlySet<string>,
  ids: readonly string[],
  field?: Held['field'],
): object {
  const key = ids.join(ID_SEPARATOR);
  let byIds = copies.get(base);
  if (!byIds) {
    byIds = new Map();
    copies.set(base, byIds);
  }
  let copy = byIds.get(key) as Row | undefined;
  if (!copy) {
    copy = copyOf(base);
    const all = new Set(lifted);
    if (!(SLOTS in base)) {
      // The combined values come off the relation keys, which hold only what a select lifts back.
      for (const name of Object.keys(slots.relations)) {
        delete copy[name];
      }
    }
    for (const id of ids) {
      if (!all.has(id) && slots.consumers.has(id)) {
        lift(copy, slots, id);
        all.add(id);
      }
    }
    (copy as Holder)[SLOTS] = { row, slots, lifted: all, ...(field ? { field } : {}) };
    owned.add(copy);
    byIds.set(key, copy);
  }
  return copy;
}

/**
 * The parent the readers of a type see, whose type-level selects are `ids`, the type last. For an
 * ORM row with `combine()` values, a copy without them, holding them under `SLOTS`, with what those
 * selects loaded written on. A copy this plugin made is made again from its row. A copy another
 * plugin made of one is kept, with only what it lacks written onto a copy of it. Two selects
 * computing one key fail when the statement is built (see `assertOneWriter` in adapter.ts).
 */
export function typeCopy(value: object, model: PrismaNextModel, ids: readonly string[]): object {
  const held = (value as Holder)[SLOTS];
  if (held && !owned.has(value)) {
    return ids.every((id) => held.lifted.has(id) || !held.slots.consumers.has(id))
      ? value
      : copyWith(value, held.row, held.slots, held.lifted, ids);
  }
  const row = held ? held.row : value;
  const slots = held ? held.slots : slotsOf(row, model);
  if (slots === NO_SLOTS) {
    return row;
  }
  return copyWith(row, row, slots, new Set(), ids);
}

/**
 * The parent of a field planned at `position`: the type's, with what the field's consumer loaded
 * written onto a copy of it, which only the field's resolver and the plugins after this one see.
 */
export function fieldCopy(
  value: object,
  model: PrismaNextModel,
  ids: readonly string[],
  position: Position,
): object {
  const base = typeCopy(value, model, ids);
  const held = (base as Holder)[SLOTS];
  const id = consumerId(position);
  if (!held?.slots.consumers.has(id)) {
    return base;
  }
  return copyWith(base, held.row, held.slots, held.lifted, [id], { id, position });
}

/** The consumer `parent`, a field's copy, was made for, and the position it was planned at. */
export function fieldBranch(parent: object): Held['field'] {
  return (parent as Holder)[SLOTS]?.field;
}

/** The value `key` the consumer of `parent`, a field's copy, computed from relation `name`. */
export function fieldValue(parent: object, name: string, key: string): unknown {
  const held = (parent as Holder)[SLOTS];
  return held?.field && held.slots.relations[name]?.values[held.field.id]?.[key];
}

/**
 * Whether the statement that loaded `parent`, a copy for a type, loaded consumer `id`'s values from
 * relation `name`.
 */
export function loadedValues(parent: object, name: string, id: string) {
  const held = (parent as Holder)[SLOTS];
  return !!held?.slots.relations[name]?.values[id];
}

/**
 * `loaded`, a row a reload returned, with the keys of `row` that aren't columns or relations of
 * `model`. It is copied only when there are such keys.
 */
export function withOtherKeys(loaded: Row, row: object, model: PrismaNextModel): Row {
  let next: Row | undefined;
  for (const key of Object.keys(row)) {
    if (
      !model.columns.has(key) &&
      !Object.hasOwn(model.relations, key) &&
      !model.sharedVariantRelations.has(key)
    ) {
      next ??= copyOf(loaded);
      next[key] = (row as Row)[key];
    }
  }
  return next ?? loaded;
}

/** Copies a row into a writable object with the same prototype and type brand. */
function copyOf(row: object): Row {
  const copy = Object.assign(Object.create(Object.getPrototypeOf(row)) as object, row) as Row;
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
  ErrorClass: new (message: string) => Error = InternalError,
  problem?: Parameters<typeof orderColumns>[4],
) {
  const order = orderBy && orderColumns(contract, modelKey, orderBy, ErrorClass, problem);
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
    relations: { [relation.isToMany ? slotKey(name, id) : name]: resolved },
  }));
}

/** The values consumer `id` computes from relation `name`, identified by `loadIdentity`. */
export function computedSelection(
  name: string,
  id: string,
  loadIdentity: unknown,
  compute: Compute,
): PrismaNextSelection {
  return { computed: { [slotKey(name, id)]: { loadIdentity, [COMPUTE]: compute } } };
}

/**
 * The columns and relations of a `select`. The types check its entries. `ErrorClass` is
 * `PothosSchemaError` for a `select` checked when the schema is built.
 */
export function splitSelect(
  raw: RawSelect,
  model: PrismaNextModel,
  ErrorClass?: new (message: string) => Error,
) {
  const columns: string[] = [];
  const relations: [string, unknown][] = [];
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
      throw sharedVariantRelationError(`a select of model '${model.key}'`, key, model, ErrorClass);
    } else {
      columns.push(key);
    }
  }
  return { columns, relations };
}

/**
 * Whether a `select` entry loads the rows of `relation` through a variant model with a table of its
 * own, which can't read the columns it inherits. Function and page entries don't hand over rows
 * loaded that way.
 */
export function loadsOwnTableVariantRows(relation: PrismaNextRelation, value: unknown) {
  return (
    typeof value !== 'function' &&
    !isPageEntry(value) &&
    relation.targetVariantModel?.sharesTable === false
  );
}

interface SelectCompilation {
  contract: AnyContract;
  id: string;
  args: object;
  /** Identifies the select's function entries, together with `args`. */
  source: unknown;
  /**
   * Plans the rows a relation entry loads, starting from `seed`. A field plans them beneath its
   * own selection. A type-level select includes them as they are.
   */
  rows(
    relation: PrismaNextRelation,
    name: string,
    seed: PrismaNextSelection,
  ): MaybePromise<PrismaNextSelection>;
  /** The field a field's `select` plans for. The types allow page entries only there. */
  field?: FieldPlanning;
}

/** Compiles a `select` object or column list. Each relation entry is one consumer, `id`. */
function compileSelect(
  raw: RawSelect,
  model: PrismaNextModel,
  { contract, id, args, source, rows, field }: SelectCompilation,
): MaybePromise<PrismaNextSelection> {
  // Compiled for a request, which may be the first to see what a select function returns.
  const { columns, relations } = splitSelect(raw, model, InternalError);
  const parts = relations.map(([name, value]) => {
    const relation = model.relations[name]!;
    if (isPageEntry(value)) {
      return value[CONNECTION_PAGE](relation, name, field!);
    }
    if (typeof value === 'function') {
      // The types keep computed keys apart from each other and from the parent's fields.
      return computedSelection(name, id, { source, args }, (sub, ctx) =>
        (value as (sub: MapperCollection, args: object, ctx: object) => Record<string, unknown>)(
          sub,
          args,
          ctx,
        ),
      );
    }
    const query = value === true ? undefined : definedQuery(value);
    return rowsSelection(
      relation,
      name,
      id,
      rows(relation, name, {
        columns: null,
        args: relationArgs(relation, {
          loadIdentity: query,
          refine: query && queryRefinement(contract, relation.targetModel, query),
        }),
      }),
    );
  });
  const settled = parts.some(isThenable) ? Promise.all(parts) : (parts as PrismaNextSelection[]);
  return completeValue(settled, (resolved) => ({
    columns,
    relations: Object.assign({}, ...resolved.map((part) => part.relations)),
    computed: Object.assign({}, ...resolved.map((part) => part.computed)),
  }));
}

/** Compiles a type-level `select`. Its relations load every column, in the type's own slots. */
export function compileTypeSelect(
  contract: AnyContract,
  raw: RawSelect,
  model: PrismaNextModel,
  typeName: string,
) {
  return compileSelect(raw, model, {
    contract,
    id: typeName,
    args: {},
    source: typeName,
    rows: (_relation, _name, seed) => seed,
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
 * at the field's position.
 */
export function compileFieldSelect(
  contract: AnyContract,
  raw: RawSelect | ((args: object, ctx: object) => MaybePromise<RawSelect | null | undefined>),
  model: PrismaNextModel,
): PrismaNextSelection | PrismaNextSelectFn {
  if (typeof raw !== 'function') {
    const { columns, relations } = splitSelect(raw, model);
    if (relations.length === 0) {
      return { columns };
    }
  }
  return (args, ctx, nested, selected, position) => {
    const returnModelKey = getNamedType(position.field.type).extensions?.[PRISMA_NEXT_MODEL] as
      | string
      | undefined;
    const returnModel =
      returnModelKey === undefined ? undefined : getModel(contract, returnModelKey);
    const id = consumerId(position);
    const select: SelectCompilation = {
      contract,
      id,
      args,
      source: raw,
      field: { id, args, ctx, nested, selected, position },
      rows: (relation, name, seed) => {
        // Rows the field's selection set doesn't plan are read as they load, which for a variant
        // model with a table of its own is without the columns it inherits. An interface or union
        // reads them before any field reloads them, and only a static select completes them first.
        // The plugin checks a static select when the schema is built, so this catches what a select
        // function returns.
        if (
          typeof raw === 'function' &&
          relation.targetVariantModel?.sharesTable === false &&
          (returnModel !== relation.target || isAbstractType(getNamedType(position.field.type)))
        ) {
          throw ownTableVariantRowsError(
            `field '${position.field.name}'`,
            name,
            relation,
            InternalError,
          );
        }
        // A field that returns another model has a selection set that can't load from these rows.
        if (returnModel && returnModel !== relation.target) {
          return seed;
        }
        // A to-many relation to a hierarchy's base, typed as one of its variants, loads that
        // variant. A to-one relation is keyed on the row by its name, so it loads whole.
        const variant = variantForRelationType(
          contract,
          `Field '${position.field.name}'`,
          relation.targetModel,
          returnModelKey,
          InternalError,
        );
        return nested(
          variant === undefined || !relation.isToMany
            ? seed
            : { ...seed, args: { ...seed.args, variant: { value: variant } } },
        );
      },
    };
    return completeOption(raw, args, ctx, (value) => compileSelect(value ?? {}, model, select));
  };
}
