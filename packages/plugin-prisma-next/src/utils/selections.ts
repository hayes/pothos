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
import { type GraphQLResolveInfo, getNamedType } from 'graphql';
import { PRISMA_NEXT_MODEL } from '../constants.js';
import type { AnyContract } from '../types/models.js';
import type { MapperCollection } from './adapter.js';
import { variantForRelationType } from './contract.js';
import { keepError } from './errors.js';
import {
  getModel,
  ownTableVariantRowsError,
  type PrismaNextModel,
  type PrismaNextRelation,
  sharedVariantRelationError,
} from './model.js';

/*
 * Scopes and slot keys
 *
 * A scope names one consumer of a to-many relation. A field's scope is `Type.alias`, joined with
 * `/` beneath the scopes of the fields above it (`Query.users/User.posts`), where `Type` is the
 * first type the selection was planned on with that definition of the field (see `slotOwner`). A
 * type-level `select` uses the type's name as its scope. Type names have no dot, so the two kinds
 * never collide.
 *
 * In a selection, a to-many relation and its computed values are keyed `relation:scope`, so each
 * consumer gets its own `combine()` slot. In the combined value the ORM returns, a consumer's rows
 * are keyed `scope` and its computed values `scope:key`. Consumers that load the same rows share a
 * slot, keyed by their scopes joined with a space.
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
 * relation and its computed values are keyed `relation:scope`. Consumers with different arguments
 * then get separate `combine()` slots and still load in one statement. A to-one relation loaded
 * whole is keyed by its name, so every reader of the row sees it there. A filtered one is keyed
 * `relation:scope` like a to-many relation. The ORM includes a to-one relation once, so `emit`
 * picks one load for it (see `PrismaNextAdapter.emitToOne`) and `takeSlots` moves a filtered one
 * off the row into a slot only its consumers read.
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
  scope: string;
  args: object;
  ctx: object;
  nested: NestedSelection<PrismaNextSelection>;
  selected: SelectedFieldNode;
  position: Position;
}

/** What a field's select function threw, by the position it was planned at. */
const planningFailures = new WeakMap<Position, { error: unknown }>();

/**
 * A field's select function that, when it throws or rejects, records the error at its position and
 * selects nothing, so the query it was planned into still runs. The empty selection keeps the
 * field's mapping, which leads its resolver to the position, and the resolver throws the error
 * (`throwPlanningFailure`). A select that fails beneath it records its own position, so only the
 * field that failed does.
 */
export function recordingFailures(select: PrismaNextSelectFn): PrismaNextSelectFn {
  return (args, ctx, nested, selected, position) => {
    const fail = (error: unknown) => {
      // The resolver rethrows it as it is.
      planningFailures.set(position, { error: keepError(error) });
      return EMPTY;
    };
    try {
      const query = select(args, ctx, nested, selected, position);
      return isThenable(query) ? Promise.resolve(query).catch(fail) : query;
    } catch (error) {
      return fail(error);
    }
  };
}

/** Throws what the select function of the field planned at `position` threw, if it threw. */
export function throwPlanningFailure(position: Position | undefined) {
  const failure = position && planningFailures.get(position);
  if (failure) {
    throw failure.error;
  }
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

/** Separates a relation from a scope in a selection key, and a scope from a slot's computed key. */
export const KEY_SEPARATOR = ':';
/** Joins the scopes of consumers that share a slot. */
export const SCOPE_SEPARATOR = ' ';

/**
 * The key a connection's count is computed under. Its leading `KEY_SEPARATOR` keeps it off the
 * parent row: it stays in the consumer's slot, which the connection reads.
 */
export const COUNT_SLOT = `${KEY_SEPARATOR}count`;

const scopes = new WeakMap<Position, string>();
/** The type each definition of a field is named after, per selection of the field. */
const slotOwners = new WeakMap<object, Map<unknown, string>>();

/**
 * The scope of the field selected at `position`. A resolver reaches the same position through its
 * loader mapping, so it reads the slots its selection was planned into. Only that agreement
 * matters, so it reads `walkParent`: a walk shared between the types a field is reached on writes
 * and reads one scope, and naming its slots does not make it unshareable.
 */
export function scopeOf(position: Position): string {
  let scope = scopes.get(position);
  if (scope === undefined) {
    const own = `${slotOwner(position)}.${position.node.alias?.value ?? position.node.name.value}`;
    scope = position.walkParent ? `${scopeOf(position.walkParent)}/${own}` : own;
    scopes.set(position, scope);
  }
  return scope;
}

/**
 * The type a field's slots are named after. An implementation that inherits a field loads what the
 * interface does, so one selection of the field shares one slot whichever type it is planned on.
 * A slot per type would copy everything beneath the field once per type, at every level of the
 * query. An override is another definition of the field, so it gets a slot of its own.
 */
function slotOwner({ node, field, type }: Position) {
  let owners = slotOwners.get(node);
  if (!owners) {
    owners = new Map();
    slotOwners.set(node, owners);
  }
  const definition = field.extensions?.pothosOptions ?? field;
  let owner = owners.get(definition);
  if (owner === undefined) {
    owner = type.name;
    owners.set(definition, owner);
  }
  return owner;
}

/** The selection key a consumer at `scope` uses for a to-many relation or its computed values. */
function slotKey(relation: string, scope: string) {
  return `${relation}${KEY_SEPARATOR}${scope}`;
}

function relationKey(
  relation: PrismaNextRelation,
  name: string,
  scope: string,
  selection: PrismaNextSelection,
) {
  return relation.isToMany || !loadsWholeRelation(selection) ? slotKey(name, scope) : name;
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

/** A type-level select's scope is the type's name, which has no dot. */
function isTypeScope(scope: string) {
  return !scope.includes('.');
}

type Row = Record<string, unknown>;

/**
 * What `emit` included for each relation of a level, which `takeSlots` reads the rows it loaded
 * by. Rows read without one keep every to-one relation they hold on the row.
 */
export type IncludeRecord = Readonly<Record<string, IncludedRelation>>;

export interface IncludedRelation {
  /** What is included beneath the relation's rows, when the row holds them. */
  readonly nested?: IncludeRecord;
  /** What is included beneath the rows of each `combine()` slot, by slot key. */
  readonly slots?: Readonly<Record<string, IncludeRecord>>;
  /** The slot key of each `combine()` branch, by the branch's name in the statement. */
  readonly names?: Readonly<Record<string, string>>;
  /** The filtered to-one consumers the include loaded for. Undefined for the whole relation. */
  readonly scopes?: readonly string[];
  /** The filtered to-one consumers left out of the include. Their fields reload. */
  readonly dropped?: readonly string[];
}

/** What the consumers of one to-many relation loaded through `combine()`, by consumer scope. */
interface RelationSlots {
  readonly rows: ReadonlyMap<string, unknown>;
  readonly values: ReadonlyMap<string, Row>;
}

/** What `takeSlots` took off a row, shared by the row and every projection of it. */
interface RowSlots {
  /** The row `takeSlots` returned. Undefined for a row with no slots. */
  readonly row: Row | undefined;
  /** The slots of each to-many relation loaded through `combine()`, by relation name. */
  readonly slots: Readonly<Record<string, RelationSlots>>;
  /**
   * The filtered loads of each to-one relation, by consumer scope, by relation name. A consumer
   * left out of the statement has `undefined`.
   */
  readonly toOne: Readonly<Record<string, ReadonlyMap<string, unknown>>>;
  /** Every scope that has a slot on the row. */
  readonly scopes: ReadonlySet<string>;
  /**
   * Whether type-level selects loaded different versions of a relation or computed value. None is
   * then written onto the row, and each type's readers get a projection with their own.
   */
  readonly conflict: boolean;
  /** Projections of the row, keyed by the scopes they write onto it. */
  projections?: Map<string, object>;
  /** A to-one relation a field reloaded with its own query or variant, by the field's scope. */
  refined?: Map<string, unknown>;
}

/** A row `takeSlots` returned with nothing taken off it. */
const PLAIN: RowSlots = Object.freeze({
  row: undefined,
  slots: Object.freeze({}),
  toOne: Object.freeze({}),
  scopes: new Set<string>(),
  conflict: false,
});

/** The slots of each row `takeSlots` returned, and of each projection of one. */
const rowSlots = new WeakMap<object, RowSlots>();

/** The relation each row of a variant model loaded through, by the row `takeSlots` returned. */
const variantRows = new WeakMap<object, PrismaNextRelation>();

function markVariantRows(rows: unknown, relation: PrismaNextRelation) {
  if (!relation.targetVariantModel || !rows || typeof rows !== 'object') {
    return;
  }
  for (const row of Array.isArray(rows) ? rows : [rows]) {
    if (row && typeof row === 'object') {
      variantRows.set(row, relation);
    }
  }
}

/**
 * The relation targeting a variant model that `row` loaded through, which left out the base
 * model's columns and relations the variant model's own accessor can't read.
 */
export function loadedThrough(row: object) {
  return variantRows.get(row);
}

/**
 * Takes the slots off the rows a statement returned, reading them by what `emit` included
 * (`record`). A to-many relation loaded through `combine()` comes back as an object with one slot
 * per consumer scope, and a to-one relation loaded for filtered consumers holds their version. A
 * row with either is copied without them, and the copy gets the rows and computed values its
 * type-level selects loaded, unless they disagree. Field helpers read their own slots through
 * `fieldSlots`. The ORM's rows are never changed: a row with no slots, and none beneath it, is
 * returned as it is.
 */
export function takeSlots<T>(rows: T, model: PrismaNextModel, record?: IncludeRecord): T {
  if (Array.isArray(rows)) {
    let copy: unknown[] | undefined;
    for (let i = 0; i < rows.length; i += 1) {
      const row: unknown = rows[i];
      const next = takeSlots(row, model, record);
      if (next !== row) {
        copy ??= [...rows];
        copy[i] = next;
      }
    }
    return (copy ?? rows) as T;
  }
  return rows && typeof rows === 'object' ? (takeRowSlots(rows as Row, model, record) as T) : rows;
}

// Takes fresh ORM rows only. A row whose slots were already taken off would lose them.
function takeRowSlots(row: Row, model: PrismaNextModel, record: IncludeRecord | undefined): Row {
  let nested: Row | undefined;
  let slots: Record<string, RelationSlots> | undefined;
  let toOne: Record<string, Map<string, unknown>> | undefined;
  /** Relations whose value comes off the row. */
  const taken: string[] = [];
  const scopes = new Set<string>();
  for (const name in model.relations) {
    const relation = model.relations[name]!;
    const included = record?.[name];
    const value = row[name];
    if (!relation.isToMany && (included?.scopes || included?.dropped?.length)) {
      const own = new Map<string, unknown>();
      toOne ??= {};
      toOne[name] = own;
      for (const scope of included.dropped ?? []) {
        own.set(scope, undefined);
        scopes.add(scope);
      }
      if (included.scopes) {
        // A filtered version never stands in for the relation on the row.
        taken.push(name);
        const loaded = takeSlots(value, relation.target, included.nested);
        markVariantRows(loaded, relation);
        for (const scope of included.scopes) {
          own.set(scope, loaded);
          scopes.add(scope);
        }
        continue;
      }
    }
    if (!value || typeof value !== 'object') {
      continue;
    }
    if (!relation.isToMany || Array.isArray(value)) {
      const next = takeSlots(value, relation.target, included?.nested);
      markVariantRows(next, relation);
      if (next !== value) {
        nested ??= {};
        nested[name] = next;
      }
      continue;
    }
    taken.push(name);
    const rows = new Map<string, unknown>();
    const values = new Map<string, Row>();
    slots ??= {};
    slots[name] = { rows, values };
    for (const [branch, slot] of Object.entries(value)) {
      // Rows are keyed by scope and computed values by `scope:key`. Consumers that share either are
      // keyed by their scopes joined with a space.
      const key = included?.names?.[branch] ?? branch;
      const scope = relationName(key);
      if (scope === key) {
        const loaded = takeSlots(slot, relation.target, included?.slots?.[key]);
        markVariantRows(loaded, relation);
        for (const consumer of key.split(SCOPE_SEPARATOR)) {
          rows.set(consumer, loaded);
          scopes.add(consumer);
        }
      } else {
        for (const consumer of scope.split(SCOPE_SEPARATOR)) {
          const own = values.get(consumer) ?? {};
          own[key.slice(scope.length + KEY_SEPARATOR.length)] = slot;
          values.set(consumer, own);
          scopes.add(consumer);
        }
      }
    }
  }
  if (!slots && !toOne) {
    const next = nested ? Object.assign(copyOf(row), nested) : row;
    rowSlots.set(next, PLAIN);
    return next;
  }
  const next = copyOf(row);
  for (const name of taken) {
    delete next[name];
  }
  Object.assign(next, nested);
  // Type-level selects load to-one relations whole, so only to-many slots can disagree.
  const typeScopes = [...scopes].filter(isTypeScope);
  const entry: RowSlots = {
    row: next,
    slots: slots ?? PLAIN.slots,
    toOne: toOne ?? PLAIN.toOne,
    scopes,
    conflict: disagree(slots ?? PLAIN.slots, typeScopes),
  };
  if (!entry.conflict) {
    lift(next, entry, typeScopes);
  }
  rowSlots.set(next, entry);
  return next;
}

/** Whether two of `scopes` loaded different rows of a relation, or computed the same key. */
function disagree(slots: RowSlots['slots'], scopes: readonly string[]) {
  if (scopes.length < 2) {
    return false;
  }
  const computed = new Set<string>();
  for (const { rows, values } of Object.values(slots)) {
    if (
      new Set(scopes.filter((scope) => rows.has(scope)).map((scope) => rows.get(scope))).size > 1
    ) {
      return true;
    }
    for (const scope of scopes) {
      for (const key of Object.keys(values.get(scope) ?? {})) {
        if (computed.has(key)) {
          return true;
        }
        computed.add(key);
      }
    }
  }
  return false;
}

/**
 * Writes the rows and computed values that `scopes` loaded onto `target`. Later scopes win. A
 * connection's count stays in its slot, and a page counted without rows has none. A filtered
 * to-one relation left out of the statement is removed, so no reader takes another version of it
 * for its own.
 */
function lift(target: Row, { slots, toOne }: RowSlots, scopes: readonly string[]) {
  for (const scope of scopes) {
    for (const name of Object.keys(slots)) {
      const { rows, values } = slots[name]!;
      const { [COUNT_SLOT]: count, ...computed } = values.get(scope) ?? {};
      if (rows.has(scope)) {
        target[name] = rows.get(scope);
      } else if (count !== undefined) {
        target[name] = [];
      }
      Object.assign(target, computed);
    }
    for (const name of Object.keys(toOne)) {
      const own = toOne[name]!;
      if (own.has(scope)) {
        const value = own.get(scope);
        if (value === undefined) {
          delete target[name];
        } else {
          target[name] = value;
        }
      }
    }
  }
}

/** Whether the statement that returned `row` loaded to-many relation `name` into slots. */
export function loadedSlots(row: object, name: string) {
  return !!rowSlots.get(row)?.slots[name];
}

/**
 * Whether a filtered to-one relation the field planned at `position` selects was left out of the
 * statement that loaded `row`, because another load of the relation took its include.
 */
export function leftOut(row: object, position: Position | undefined) {
  const entry = rowSlots.get(row);
  if (!entry || !position) {
    return false;
  }
  const scope = scopeOf(position);
  return Object.values(entry.toOne).some((own) => own.has(scope) && own.get(scope) === undefined);
}

/** The row `takeSlots` returned that `value` is, or is a projection of. */
export function rowOf(value: object): object {
  return rowSlots.get(value)?.row ?? value;
}

/** A copy of `base` with what `scopes` loaded written onto it, cached per row and scopes. */
function projection(entry: RowSlots, base: object, scopes: readonly string[]) {
  const key = scopes.join(SCOPE_SEPARATOR);
  entry.projections ??= new Map();
  let projected = entry.projections.get(key);
  if (!projected) {
    const copy = copyOf(base);
    lift(copy, entry, scopes);
    rowSlots.set(copy, entry);
    entry.projections.set(key, copy);
    projected = copy;
  }
  return projected;
}

/**
 * The parent the readers of a type see, whose type-level selects are `scopes`, the type last: the
 * row itself, unless type-level selects disagree about what they loaded. Then it is a projection
 * with the rows and values `scopes` loaded, cached so per-row caches such as scope-auth's see one
 * object.
 */
export function parentForType(value: object, scopes: readonly string[]): object {
  const entry = rowSlots.get(value);
  const row = entry?.row ?? value;
  if (!entry?.conflict) {
    return row;
  }
  const present = scopes.filter((scope) => entry.scopes.has(scope));
  if (!present.length) {
    return row;
  }
  if (!entry.projections?.has(present.join(SCOPE_SEPARATOR))) {
    assertOneWriter(entry, present);
  }
  return projection(entry, row, present);
}

/**
 * Throws when two `select`s of one type compute the same key, of which the type's parent holds one
 * value that the fields and auth checks of both read. A select function's keys are only known
 * once it runs, so this is checked on the rows it loaded, whatever their values. `disagree` flags
 * every such row, as it does rows where implementations of one interface compute the same key.
 */
function assertOneWriter({ slots }: RowSlots, scopes: readonly string[]) {
  const writers = new Map<string, { scope: string; relation: string }>();
  for (const scope of scopes) {
    for (const [relation, { values }] of Object.entries(slots)) {
      for (const key of Object.keys(values.get(scope) ?? {})) {
        const first = writers.get(key);
        if (!first) {
          writers.set(key, { scope, relation });
          continue;
        }
        const from =
          first.relation === relation
            ? `relation '${relation}'`
            : `relations '${first.relation}' and '${relation}'`;
        throw new Error(
          `'${first.scope}' and '${scope}' both compute '${key}' from ${from} in their select. A row holds one value for it, which the fields and auth checks of both types read. Give one of them a different name.`,
        );
      }
    }
  }
}

/** The position each parent `parentForField` returned a copy for was planned at. */
const fieldParents = new WeakMap<object, Position>();

/**
 * The parent a field with its own `select` sees: the type's, with what the field's select loaded
 * at `position` written onto a copy of it. Nothing else sees the copy.
 */
export function parentForField(
  value: object,
  scopes: readonly string[],
  position: Position | undefined,
) {
  const base = parentForType(value, scopes);
  const entry = rowSlots.get(value);
  const scope = position && scopeOf(position);
  if (!entry || scope === undefined || !entry.scopes.has(scope)) {
    return base;
  }
  const present = entry.conflict ? scopes.filter((type) => entry.scopes.has(type)) : [];
  const parent = projection(entry, base, [...present, scope]);
  fieldParents.set(parent, position!);
  return parent;
}

/** The slots of the field whose parent `parentForField` returned, which its helpers read. */
export function slotsOfFieldParent(parent: object): FieldSlots | undefined {
  const position = fieldParents.get(parent);
  return position && fieldSlots(parent, position);
}

/**
 * Records `value`, a to-one relation a field reloaded with its own query or variant, for the
 * field's helper to read at `scope`, and returns the parent the field's plugins see: `parent`, the
 * row the field had, which holds the declared relation.
 */
export function refineKeptToOne(parent: object, value: unknown, scope: string | undefined): object {
  const entry = rowSlots.get(parent);
  if (!entry?.row) {
    rowSlots.set(parent, {
      row: parent as Row,
      slots: entry?.slots ?? PLAIN.slots,
      toOne: entry?.toOne ?? PLAIN.toOne,
      scopes: entry?.scopes ?? PLAIN.scopes,
      conflict: false,
      refined: new Map(scope === undefined ? [] : [[scope, value]]),
    });
    return parent;
  }
  if (scope !== undefined) {
    entry.refined ??= new Map();
    entry.refined.set(scope, value);
  }
  return parent;
}

/** What a field helper's selection loaded on its parent. */
export interface FieldSlots {
  /** The position that planned the helper, which its connection plan is keyed by. */
  position: Position | undefined;
  /** The rows of relation `name` the helper loaded. Undefined when they weren't. */
  rows(name: string): unknown;
  /** The value the helper computed as `key` from relation `name`. */
  value(name: string, key: string): unknown;
}

/**
 * The slots a field helper planned at `position` reads on `parent`. Undefined when `parent` is not
 * a row `takeSlots` returned or a projection of one: another plugin replaced it, and the helper
 * reloads it.
 */
export function fieldSlots(parent: object, position: Position | undefined): FieldSlots | undefined {
  const entry = rowSlots.get(parent);
  if (!entry) {
    return undefined;
  }
  const scope = position && scopeOf(position);
  const values = (name: string) =>
    scope === undefined ? undefined : entry.slots[name]?.values.get(scope);
  return {
    position,
    rows: (name) => {
      const own = entry.slots[name];
      if (own) {
        return scope === undefined ? undefined : own.rows.get(scope);
      }
      if (scope !== undefined && entry.refined?.has(scope)) {
        return entry.refined.get(scope);
      }
      const toOne = entry.toOne[name];
      return scope !== undefined && toOne?.has(scope) ? toOne.get(scope) : (parent as Row)[name];
    },
    value: (name, key) => values(name)?.[key],
  };
}

/** The position `wrapResolve` resolved each field helper's slots at. */
const fieldPositions = new WeakMap<GraphQLResolveInfo, Position | undefined>();

export function recordFieldPosition(info: GraphQLResolveInfo, position: Position | undefined) {
  fieldPositions.set(info, position);
}

/** The position that loaded the slots of the field helper `info` resolves. */
export function fieldPositionFor(info: GraphQLResolveInfo) {
  return fieldPositions.get(info);
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
  orderBy?: unknown;
  limit?: number;
  offset?: number;
}

/** The options of a relation's `query`, as `DeclarativeQuery` declares them. */
export const RELATION_QUERY_KEYS = ['where', 'orderBy', 'limit', 'offset'];

/**
 * Throws for a `query` the types would reject, such as an untyped caller's, instead of dropping
 * the filter beside an unknown option or inside a promise.
 */
export function assertQueryOptions(value: unknown, allowed: readonly string[], owner: string) {
  if (isThenable(value)) {
    throw new Error(`query on ${owner} can't be async. Return it synchronously.`);
  }
  // An undefined option drops nothing, so a shared options object with `orderBy: undefined` passes.
  const unknownKeys =
    value == null
      ? []
      : Object.entries(value)
          .filter(([key, option]) => option !== undefined && !allowed.includes(key))
          .map(([key]) => key);
  if (unknownKeys.length > 0) {
    throw new Error(
      `query on ${owner} has unknown options ${unknownKeys.map((key) => `'${key}'`).join(', ')}. Use { ${allowed.map((key) => `${key}?`).join(', ')} }.`,
    );
  }
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

/** The rows of `relation` a consumer at `scope` loads, with what is planned beneath them. */
export function rowsSelection(
  relation: PrismaNextRelation,
  name: string,
  scope: string,
  child: MaybePromise<PrismaNextSelection>,
): MaybePromise<PrismaNextSelection> {
  return completeValue(child, (resolved) => ({
    relations: { [relationKey(relation, name, scope, resolved)]: resolved },
  }));
}

/** The values a consumer at `scope` computes from relation `name`, identified by `loadIdentity`. */
export function computedSelection(
  name: string,
  scope: string,
  loadIdentity: unknown,
  compute: Compute,
): PrismaNextSelection {
  return { computed: { [slotKey(name, scope)]: { loadIdentity, [COMPUTE]: compute } } };
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
  scope: string;
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

/** Compiles a `select` object or column list. Each relation entry is one consumer at `scope`. */
function compileSelect(
  raw: RawSelect,
  model: PrismaNextModel,
  { scope, args, source, rows, field }: SelectCompilation,
): MaybePromise<PrismaNextSelection> {
  // Compiled for a request, which may be the first to see what a select function returns.
  const { columns, relations } = splitSelect(raw, model, Error);
  const parts = relations.map(([name, value]) => {
    const relation = model.relations[name]!;
    if (isPageEntry(value)) {
      return value[CONNECTION_PAGE](relation, name, field!);
    }
    if (typeof value === 'function') {
      // The types keep computed keys apart from each other and from the parent's fields.
      return computedSelection(name, scope, { source, args }, (sub, ctx) =>
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
      scope,
      rows(relation, name, {
        columns: null,
        args: relationArgs(relation, {
          loadIdentity: query,
          refine: query && ((rel) => applyQuery(rel, query)),
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
export function compileTypeSelect(raw: RawSelect, model: PrismaNextModel, typeName: string) {
  return compileSelect(raw, model, {
    scope: typeName,
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
    const scope = scopeOf(position);
    const select: SelectCompilation = {
      scope,
      args,
      source: raw,
      field: { scope, args, ctx, nested, selected, position },
      rows: (relation, name, seed) => {
        // Rows the field's selection set doesn't plan are read as they load, which for a variant
        // model with a table of its own is without the columns it inherits. The plugin checks a
        // static select when the schema is built, so this catches what a select function returns.
        if (returnModel !== relation.target && relation.targetVariantModel?.sharesTable === false) {
          throw ownTableVariantRowsError(`field '${position.field.name}'`, name, relation, Error);
        }
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
          Error,
        );
        return nested(
          variant === undefined
            ? seed
            : { ...seed, args: { ...seed.args, variant: { value: variant } } },
        );
      },
    };
    return completeOption(raw, args, ctx, (value) => compileSelect(value ?? {}, model, select));
  };
}
