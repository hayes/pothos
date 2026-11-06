import {
  brandWithType,
  completeValue,
  getTypeBrand,
  isThenable,
  type MaybePromise,
} from '@pothos/core';
import type {
  NestedSelection,
  PathSegment,
  Position,
  SelectedFieldNode,
  SelectFn,
} from '@pothos/selection-mapper';
import { type FieldNode, type GraphQLResolveInfo, getNamedType, isObjectType } from 'graphql';
import { PRISMA_NEXT_MODEL, PRISMA_NEXT_TYPE_SELECTS } from '../constants.js';
import type { AnyContract } from '../types/models.js';
import type { MapperCollection } from './adapter.js';
import { variantForRelationType } from './contract.js';
import { type OrderByDecl, orderCollection, orderColumns } from './cursors.js';
import { assertGraphQLJsInfo, checkReturned } from './errors.js';
import {
  getModel,
  ownTableVariantRowsError,
  type PrismaNextModel,
  type PrismaNextRelation,
  returnsRelationRowsAs,
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
/** Computes a value from a to-many relation's collection: a reducer, or a collection of rows. */
type Compute = (rel: MapperCollection) => unknown;

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
  /** The key the value is written to on the parent. */
  key: string;
  /** Identifies the computed value, like `RelationArgs.loadIdentity`. */
  loadIdentity: unknown;
  [COMPUTE]: Compute;
}

/**
 * A selection on one model. Planned node trees are written back in the same shape. A to-many
 * relation is keyed `relation:id`, and a value computed from it `relation:id:key`. Consumers with
 * different arguments then get separate `combine()` branches and still load in one statement. A
 * to-one relation is always loaded whole and keyed by its name, so every reader of the row sees it
 * there.
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

/** Marks a field `select` entry from `nestedSelection`. */
export const NESTED_SELECTION = Symbol('prismaNextNestedSelection');

/** What a `nestedSelection` entry plans: the relation's rows, as `type` at `path` beneath the field. */
interface NestedEntry {
  query?: unknown;
  path?: PathSegment[];
  type?: string;
}

/** The `nestedSelection` a field's select function is passed. */
export function nestedSelectionEntry(query?: unknown, path?: PathSegment[], type?: string) {
  return { [NESTED_SELECTION]: { query, path, type } as NestedEntry };
}

function isNestedEntry(value: unknown): value is { [NESTED_SELECTION]: NestedEntry } {
  return typeof value === 'object' && value !== null && NESTED_SELECTION in value;
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
 * Checks `info` is graphql-js's and records the operation of the fields a plan for it starts from,
 * which the consumers beneath them are numbered in. Every entry point calls it before it plans.
 * A field node in a fragment two operations of one document share is recorded for whichever
 * planned last. That is harmless: ids are fixed per position once numbered, and any table numbers
 * distinct consumers apart.
 */
export function registerPlanRoots(info: GraphQLResolveInfo) {
  assertGraphQLJsInfo(info);
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
  /** The consumers the copy was made for, whether or not the statement loaded a branch of theirs. */
  readonly types: ReadonlySet<string>;
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
 * Consumer ids to write onto a copy, and the key its copies are cached by. `own` lists, by id, the
 * keys a type's select fills only from its own branch: its filtered or refined relations and its
 * computed values. Another reader's whole relation, or a branch of another type, never stands in
 * for them.
 */
export interface CopyIds {
  readonly ids: readonly string[];
  readonly key: string;
  readonly own: ReadonlyMap<string, readonly string[]>;
}

const NO_OWN_KEYS: ReadonlyMap<string, readonly string[]> = new Map();

export function copyIds(
  ids: readonly string[],
  own: ReadonlyMap<string, readonly string[]> = NO_OWN_KEYS,
): CopyIds {
  return { ids, key: ids.join(ID_SEPARATOR), own };
}

/**
 * A copy of `base` with what `ids` loaded written onto it, cached per base and ids so per-row
 * caches such as scope-auth's see one object. The own keys of the ids it adds are cleared first,
 * so one the statement loaded no branch of theirs for reads as not loaded.
 */
function copyWith(
  base: object,
  row: object,
  slots: Slots,
  from: Held | undefined,
  { ids, key, own }: CopyIds,
  field?: Held['field'],
): object {
  let byIds = copies.get(base);
  if (!byIds) {
    byIds = new Map();
    copies.set(base, byIds);
  }
  let copy = byIds.get(key) as Row | undefined;
  if (!copy) {
    copy = copyOf(base);
    const types = new Set(from?.types);
    if (!(SLOTS in base)) {
      // The combined values come off the relation keys, which hold only what a select lifts back.
      for (const name of Object.keys(slots.relations)) {
        delete copy[name];
      }
    }
    // A key an id the copy already has defines holds that id's value, which agrees with this one.
    const kept = new Set([...types].flatMap((id) => own.get(id) ?? []));
    const added = ids.filter((id) => !types.has(id));
    for (const id of added) {
      for (const name of own.get(id) ?? []) {
        if (!kept.has(name)) {
          delete copy[name];
        }
      }
    }
    for (const id of added) {
      types.add(id);
      if (slots.consumers.has(id)) {
        lift(copy, slots, id);
      }
    }
    (copy as Holder)[SLOTS] = { row, slots, types, ...(field ? { field } : {}) };
    owned.add(copy);
    byIds.set(key, copy);
  }
  return copy;
}

/** Whether `value` holds a key one of `ids` fills only from its own branch. */
function holdsOwnKey(value: object, { ids, own }: CopyIds) {
  return ids.some((id) => own.get(id)?.some((name) => (value as Row)[name] !== undefined));
}

/**
 * `copy`, rebuilt from another plugin's copy `value`, with the keys `value` added that aren't the
 * model's or a value this plugin wrote, cached per `value`.
 */
function withAddedKeys(
  value: object,
  copy: object,
  held: Held,
  model: PrismaNextModel,
  key: string,
): object {
  const written = new Set<string>();
  for (const { values } of Object.values(held.slots.relations)) {
    for (const id of held.types) {
      for (const name of Object.keys(values[id] ?? {})) {
        written.add(name);
      }
    }
  }
  const added = Object.keys(value).filter((name) => !isModelKey(model, name) && !written.has(name));
  if (!added.length) {
    return copy;
  }
  let byIds = copies.get(value);
  if (!byIds) {
    byIds = new Map();
    copies.set(value, byIds);
  }
  let next = byIds.get(key) as Row | undefined;
  if (!next) {
    next = copyOf(copy);
    for (const name of added) {
      next[name] = (value as Row)[name];
    }
    (next as Holder)[SLOTS] = (copy as Holder)[SLOTS];
    owned.add(next);
    byIds.set(key, next);
  }
  return next;
}

/**
 * The parent the readers of a type see, whose type-level selects are `ids`, the type last. For an
 * ORM row with `combine()` values, a copy without them, holding them under `SLOTS`, with what those
 * selects loaded written on. A copy this plugin made for other ids is made again from its row. Another plugin's
 * copy of a type's copy is kept when it was made for some of `ids` alone, with only what it lacks
 * written onto a copy of it. Any other copy, such as one of another type's copy or of a field's,
 * is made again from its row, keeping the keys the other plugin added. The selects of a type and
 * its interfaces that write one key agree, which the schema build checks (see `assertSelectsAgree`
 * in index.ts).
 */
export function typeCopy(value: object, model: PrismaNextModel, ids: CopyIds): object {
  const held = (value as Holder)[SLOTS];
  const foreign = !!held && !owned.has(value);
  // This plugin's copy for these ids, which is what remaking it would return, or one keeping the
  // keys another plugin's copy added.
  if (
    !foreign &&
    held &&
    !held.field &&
    held.types.size === ids.ids.length &&
    ids.ids.every((id) => held.types.has(id))
  ) {
    return value;
  }
  if (foreign && !held.field && [...held.types].every((id) => ids.ids.includes(id))) {
    return ids.ids.every(
      (id) => held.types.has(id) || (!held.slots.consumers.has(id) && !ids.own.get(id)?.length),
    )
      ? value
      : copyWith(value, held.row, held.slots, held, ids);
  }
  const row = held ? held.row : value;
  const slots = held ? held.slots : slotsOf(row, model);
  if (!held && slots === NO_SLOTS && !holdsOwnKey(row, ids)) {
    return row;
  }
  const copy = copyWith(row, row, slots, undefined, ids);
  return foreign ? withAddedKeys(value, copy, held, model, ids.key) : copy;
}

/**
 * The parent of a field planned at `position`: the type's, with what the field's consumer loaded
 * written onto a copy of it, which only the field's resolver and the plugins after this one see.
 */
export function fieldCopy(
  value: object,
  model: PrismaNextModel,
  ids: CopyIds,
  position: Position,
): object {
  const base = typeCopy(value, model, ids);
  const held = (base as Holder)[SLOTS];
  const id = consumerId(position);
  if (!held?.slots.consumers.has(id)) {
    return base;
  }
  return copyWith(base, held.row, held.slots, held, copyIds([id]), { id, position });
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
 * `loaded`, a row a reload returned, with the keys of `row` that aren't columns or relations of
 * `model`. It is copied only when there are such keys.
 */
export function withOtherKeys(loaded: Row, row: object, model: PrismaNextModel): Row {
  let next: Row | undefined;
  for (const key of Object.keys(row)) {
    if (!isModelKey(model, key)) {
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

/** Copies a row into a writable object with the same prototype and type brand. */
function copyOf(row: object): Row {
  const copy = Object.assign(Object.create(Object.getPrototypeOf(row)) as object, row) as Row;
  const brand = getTypeBrand(row);
  if (brand) {
    brandWithType(copy, brand);
  }
  return copy;
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

/** The value consumer `id` computes from relation `name` under `key`, identified by `loadIdentity`. */
export function computedSelection(
  name: string,
  id: string,
  key: string,
  loadIdentity: unknown,
  compute: Compute,
): PrismaNextSelection {
  return {
    computed: {
      [`${slotKey(name, id)}${KEY_SEPARATOR}${key}`]: { key, loadIdentity, [COMPUTE]: compute },
    },
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
  /**
   * The select function the entries came from. A function builds new entries on every call, so
   * it identifies their loads together with `args`. A static select's entries identify themselves.
   */
  source?: unknown;
  /** The field a field's `select` plans for. The types allow page and nested entries only there. */
  field?: FieldPlanning;
  /** The model of the field's type, which a static select's to-many relation entries narrow to. */
  returnModelKey?: string;
  /** The model of the type a nested entry names. */
  typeModel?: (typeName: string) => string | undefined;
}

/**
 * The variant a static field select's relation entry loads: a to-many relation to a hierarchy's
 * base, on a field typed as one of its variants, loads that variant. A to-one relation is keyed on
 * the row by its name, so it loads whole. Throws for a type of another branch of the hierarchy,
 * which the plugin checks when the schema is built.
 */
export function staticEntryVariant(
  contract: AnyContract,
  owner: string,
  relation: PrismaNextRelation,
  value: unknown,
  returnModelKey: string | undefined,
) {
  if (
    isPageEntry(value) ||
    returnModelKey === undefined ||
    getModel(contract, returnModelKey) !== relation.target
  ) {
    return undefined;
  }
  const variant = variantForRelationType(contract, owner, relation.targetModel, returnModelKey);
  return relation.isToMany ? variant : undefined;
}

/** Compiles a split `select`. Each relation entry is one consumer, `id`. */
function compileSelect(
  { columns, relations, computed }: SplitSelect,
  model: PrismaNextModel,
  { contract, id, args, source, field, returnModelKey, typeModel }: SelectCompilation,
): MaybePromise<PrismaNextSelection> {
  const identity = (entry: unknown) => (source === undefined ? entry : { source, args });
  const owner = field && `Field '${field.position.type.name}.${field.position.field.name}'`;
  // `true`, a declarative query, or a function refining the rows, narrowed to `variant`.
  const load = (relation: PrismaNextRelation, value: unknown, variant?: string) => {
    const query = value === true || typeof value === 'function' ? undefined : definedQuery(value);
    const refine =
      typeof value === 'function'
        ? (value as Refine)
        : query && queryRefinement(contract, relation.targetModel, query);
    return relationArgs(relation, {
      loadIdentity: typeof value === 'function' ? identity(value) : query,
      refine: refine as ((rel: MapperCollection) => MapperCollection) | undefined,
      variant,
    });
  };
  const parts = relations.map(([name, value]) => {
    const relation = model.relations[name]!;
    if (isPageEntry(value)) {
      return value[CONNECTION_PAGE](relation, name, field!);
    }
    if (!isNestedEntry(value)) {
      const variant =
        field && source === undefined
          ? staticEntryVariant(contract, owner!, relation, value, returnModelKey)
          : undefined;
      return rowsSelection(relation, name, id, {
        columns: null,
        args: load(relation, value, variant),
      });
    }
    // The rows are planned as the field's type, or as `type` at `path` beneath it. Rows of a
    // to-many relation planned as a variant of its target, rather than at a path beneath, load
    // that variant.
    const { query, path, type } = value[NESTED_SELECTION];
    const { nested, ctx } = field!;
    const variant =
      relation.isToMany && !path?.length
        ? variantForRelationType(
            contract,
            owner!,
            relation.targetModel,
            type === undefined ? returnModelKey : typeModel!(type),
          )
        : undefined;
    return completeOption(query ?? true, args, ctx, (resolved) =>
      rowsSelection(
        relation,
        name,
        id,
        nested(
          {
            columns: null,
            args: checkReturned(resolved, (q) => load(relation, q ?? true, variant)),
          },
          path,
          type,
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

/** Compiles a type-level `select`. Its relations load every column, in the type's own slots. */
export function compileTypeSelect(
  contract: AnyContract,
  split: SplitSelect,
  model: PrismaNextModel,
  typeName: string,
) {
  return compileSelect(split, model, { contract, id: typeName, args: {} }) as PrismaNextSelection;
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
  typeModel: (typeName: string) => string | undefined,
): PrismaNextSelection | PrismaNextSelectFn {
  if (typeof raw !== 'function') {
    // A static select is checked when the schema is built, so it is split once, here.
    const split = splitSelect(raw, model);
    if (split.relations.length === 0 && split.computed.length === 0) {
      return { columns: split.columns };
    }
    return (args, ctx, nested, selected, position) => {
      const id = consumerId(position);
      const field: FieldPlanning = { id, args, ctx, nested, selected, position };
      const returnModelKey = getNamedType(position.field.type).extensions?.[PRISMA_NEXT_MODEL] as
        | string
        | undefined;
      return compileSelect(split, model, { contract, id, args, field, returnModelKey });
    };
  }
  return (args, ctx, nested, selected, position) => {
    const id = consumerId(position);
    const field: FieldPlanning = { id, args, ctx, nested, selected, position };
    const returnType = getNamedType(position.field.type);
    const returnModelKey = returnType.extensions?.[PRISMA_NEXT_MODEL] as string | undefined;
    const select: SelectCompilation = {
      contract,
      id,
      args,
      source: raw,
      field,
      returnModelKey,
      typeModel,
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
        return compileSelect(split, model, select);
      }),
    );
  };
}
