import { completeValue, isThenable, type MaybePromise } from '@pothos/core';
import type {
  NestedSelection,
  PathSegment,
  Position,
  SelectedFieldNode,
} from '@pothos/selection-mapper';
import { getNamedType, isObjectType } from 'graphql';
import { PRISMA_NEXT_MODEL, PRISMA_NEXT_TYPE_SELECTS } from '../constants.js';
import type { AnyContract } from '../types/models.js';
import type { PrismaNextExecutionContext } from '../types/plugin-options.js';
import type { MapperCollection } from './adapter.js';
import type { PrismaNextConfig } from './config.js';
import { variantForRelationType } from './contract.js';
import {
  isOrderByDecl,
  type OrderByOption,
  orderableProblem,
  orderCollection,
  orderColumns,
} from './cursors.js';
import { checkReturned } from './errors.js';
import {
  type DeclarativeQuery,
  fieldLoads,
  keyOf,
  type Load,
  type LoadRef,
  queryLoad,
  record,
  refOf,
} from './loads.js';
import {
  getModel,
  ownTableVariantRowsError,
  type PrismaNextModel,
  type PrismaNextRelation,
  returnsRelationRowsAs,
  sharedVariantRelationError,
} from './model.js';
import {
  COMPUTE,
  type Compute,
  type Narrowing,
  type PrismaNextSelectFn,
  type PrismaNextSelection,
  REFINE,
  type RelationArgs,
} from './selections.js';

/** Marks a field `select` entry that loads a connection helper's page of a to-many relation. */
export const CONNECTION_PAGE = Symbol('prismaNextConnectionPage');

/** Marks the relation of a connection helper's `select` that holds the nodes. */
export const NODE_SELECTION = Symbol('prismaNextNodeSelection');

/** The field a `select` function was invoked for, which a page entry plans beneath. */
interface FieldPlanning {
  nested: NestedSelection<PrismaNextSelection>;
  selected: SelectedFieldNode;
  position: Position;
}

/** A selection, with where the field reads each load it planned. */
export interface Planned {
  selection: PrismaNextSelection;
  ref?: LoadRef;
}

/** Plans the page a `select` entry loads from relation `name` of `model`'s rows. */
export type PlanPage = (
  model: PrismaNextModel,
  relation: PrismaNextRelation,
  name: string,
  field: FieldPlanning,
) => MaybePromise<Planned>;

/** Marks a field `select` entry from `nestedSelection`. */
export const NESTED_SELECTION = Symbol('prismaNextNestedSelection');

/**
 * A relation entry of a `select`, as `splitSelect` reads it: `{}` for `true`, or the object written.
 * `where`, `orderBy`, `limit` and `offset` load the relation's rows, `type` narrows them to a
 * variant of its target, and `select` loads what it names beneath them. A `nestedSelection` entry
 * plans the rows as `type` (by default the field's type) at `path` beneath the field, and a
 * connection helper's page entry plans a page.
 */
export interface RelationEntry {
  where?: unknown;
  orderBy?: OrderByOption;
  limit?: number;
  offset?: number;
  type?: unknown;
  select?: RawSelect;
  path?: readonly PathSegment[];
  [NESTED_SELECTION]?: true;
  [CONNECTION_PAGE]?: PlanPage;
}

/** The `nestedSelection` a field's select function is passed. */
function nestedSelectionEntry(
  options: Omit<RelationEntry, typeof NESTED_SELECTION | typeof CONNECTION_PAGE> = {},
): RelationEntry {
  return Object.freeze({ ...options, [NESTED_SELECTION]: true as const });
}

/** The model of a relation entry's `type`: a ref's, or a model's name. */
function entryTypeModel(type: unknown): string | undefined {
  return typeof type === 'string' ? type : (type as { modelKey?: string } | undefined)?.modelKey;
}

/**
 * Column names, or an object of columns (`true`), relations (`true` or a `RelationEntry`) and
 * aggregates (`relation: (collection) => ({ key: reducer })`).
 */
export type RawSelect = readonly string[] | Record<string, unknown>;

/** An aggregate of a `select`: `relation: compute`, whose keys are written onto the parent. */
interface ComputedEntry {
  relation: string;
  compute: Compute;
}

/**
 * A declarative query without the options that load nothing different, or undefined when none is
 * left: an undefined option, and a `where` or `orderBy` that is an empty object or list. The types
 * check its shape.
 */
function definedQuery(value: unknown): DeclarativeQuery | undefined {
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
 * Applies `query` to the collection of `modelKey`'s rows. A declared order is resolved once, as
 * `orderColumns` resolves it: a literal's is checked when the schema is built, so by default only a
 * computed column fails here. The ORM's selectors go to the collection's `orderBy` as they are.
 */
function queryRefinement(
  contract: AnyContract,
  modelKey: string,
  { where, orderBy, limit, offset }: DeclarativeQuery,
  problem?: Parameters<typeof orderColumns>[3],
) {
  const order = isOrderByDecl(orderBy)
    ? orderColumns(contract, modelKey, orderBy, problem)
    : undefined;
  return (collection: MapperCollection) => {
    let result = collection;
    if (where !== undefined) {
      result = result.where(where);
    }
    if (order?.length) {
      result = orderCollection(result, order);
    } else if (!order && orderBy !== undefined) {
      result = result.orderBy(orderBy);
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
 * `value`, a declarative `query` of `modelKey`'s rows, without the options that load nothing
 * different, and how it refines their collection. Both undefined for a query that loads every row.
 * `problem` rejects the columns it orders by, as `orderColumns` checks them.
 */
export function relationLoad(
  contract: AnyContract,
  modelKey: string,
  value: unknown,
  problem?: Parameters<typeof orderColumns>[3],
) {
  const query = definedQuery(value);
  return { query, refine: query && queryRefinement(contract, modelKey, query, problem) };
}

/** The args of a relation load: `variant` narrows a relation typed as a variant of its target. */
export function relationArgs(
  relation: PrismaNextRelation,
  {
    refine,
    variant,
  }: { refine?: ((rel: MapperCollection) => MapperCollection) | undefined; variant?: string } = {},
): RelationArgs {
  const target = relation.targetVariantModel;
  const narrowing: Narrowing | undefined = target
    ? { value: target.value, throughVariantModel: true }
    : variant === undefined
      ? undefined
      : { value: variant };
  return {
    ...(narrowing ? { variant: narrowing } : {}),
    ...(refine ? { refined: true, [REFINE]: refine } : {}),
  };
}

/** The selection of what `ref` reads: `child`, the rows planned, under its key. */
export function refSelection(ref: LoadRef, child: PrismaNextSelection): Planned {
  return { selection: { relations: { [keyOf(ref)]: child } }, ref };
}

/** The columns, relations and aggregates of a `select`, with each nested `select` split too. */
export interface SplitSelect {
  columns: string[];
  relations: SplitRelation[];
  computed: ComputedEntry[];
}

/** A relation entry of a split `select`, with its nested `select` split. */
type SplitRelation = [name: string, entry: RelationEntry, select: SplitSelect | undefined];

/** Splits a `select` of `model`'s rows. The types check its entries. */
export function splitSelect(raw: RawSelect, model: PrismaNextModel): SplitSelect {
  const columns: string[] = [];
  const relations: SplitRelation[] = [];
  const computed: ComputedEntry[] = [];
  for (const [key, value] of Array.isArray(raw)
    ? raw.map((column) => [column, true] as const)
    : Object.entries(raw)) {
    // A conditional entry can leave a key undefined, or null in what a select function returns.
    if (value == null) {
      continue;
    }
    if (model.sharedVariantRelations.has(key)) {
      throw sharedVariantRelationError(`a select of model '${model.key}'`, key, model);
    }
    if (!model.relations[key]) {
      columns.push(key);
    } else if (typeof value === 'function') {
      computed.push({ relation: key, compute: value as Compute });
    } else {
      const entry = value === true ? {} : (value as RelationEntry);
      relations.push([
        key,
        entry,
        entry.select && splitSelect(entry.select, model.relations[key]!.target),
      ]);
    }
  }
  return { columns, relations, computed };
}

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

interface SelectCompilation {
  contract: AnyContract;
  /** The config and request context a field's loads are interned for. A type's are all plain. */
  interning?: { config: PrismaNextConfig; ctx: object };
  args: object;
  /**
   * The select function the entries came from. It builds new callbacks on every call, so it
   * identifies an aggregate, or a query with a callback, with `args` and the entry's place. A
   * static select's entries identify themselves.
   */
  source?: unknown;
  /** The field a field's `select` plans for. The types allow page and nested entries only there. */
  field?: FieldPlanning;
  /** The model of the field's type, which `nestedSelection`'s to-many relation rows narrow to. */
  returnModelKey?: string;
  /** The name and model of the type a nested entry names. */
  typeOf?: (type: unknown) => { name: string; model: string | undefined };
  /** What loads the entries, which begins an error about them. */
  subject?: string;
  /** Set when the schema is built, which checks the columns a static select's entries order by. */
  context?: PrismaNextExecutionContext<AnyContract>;
  /** The relations from the select's root to the entries, each followed by a dot. */
  at: string;
  /**
   * Whether the entries' reader takes the rows of a relation targeting a variant model with a table
   * of its own, which load without the columns it inherits. A page entry doesn't hand rows over. Set
   * for what a select function returns, and for a static `select` when the schema is built.
   */
  readsRows?: (relation: PrismaNextRelation) => boolean;
}

/** A compiled `select`, and where its field reads each load. */
interface Compiled {
  selection: PrismaNextSelection;
  refs: LoadRef[];
}

/** A static entry's load and args, made once. */
const staticLoads = new WeakMap<RelationEntry, { load: Load; args: RelationArgs }>();

/** Compiles a split `select`. */
function compileSelect(
  { columns, relations, computed }: SplitSelect,
  model: PrismaNextModel,
  compilation: SelectCompilation,
): MaybePromise<Compiled> {
  const { contract, interning, args, source, field, returnModelKey, typeOf, at, readsRows } =
    compilation;
  const owner = field && `Field '${field.position.type.name}.${field.position.field.name}'`;
  const subject =
    compilation.subject ??
    (field
      ? `The select of field '${field.position.type.name}.${field.position.field.name}' loads`
      : "A type's select loads");
  // A type-level select's loads are the model's plain loads.
  const refFor = (load: Load): LoadRef =>
    interning ? refOf(interning.config, interning.ctx, model, load) : { load };
  const parts = relations.map(([name, entry, split]): MaybePromise<Planned> => {
    const relation = model.relations[name]!;
    if (
      readsRows &&
      !entry[CONNECTION_PAGE] &&
      relation.targetVariantModel?.sharesTable === false &&
      !readsRows(relation)
    ) {
      throw ownTableVariantRowsError(subject, name, relation);
    }
    const page = entry[CONNECTION_PAGE];
    if (page) {
      return page(model, relation, name, field!);
    }
    // A `nestedSelection` entry's rows are planned as the field's type, or as `type` at `path`
    // beneath it. Rows of a to-many relation planned as a variant of its target, rather than at a
    // path beneath, load that variant. Any other entry's `type` narrows its rows to that variant.
    // A to-one relation loads whole.
    const { path, type } = entry;
    const plans = NESTED_SELECTION in entry;
    const named = plans && type !== undefined ? typeOf!(type) : undefined;
    let loaded = source === undefined ? staticLoads.get(entry) : undefined;
    if (!loaded) {
      // A to-one relation loads whole. A static select's `type` is checked when the schema is
      // built.
      const typed = plans
        ? relation.isToMany && !path?.length
          ? variantForRelationType(
              contract,
              owner!,
              relation.targetModel,
              named ? named.model : returnModelKey,
            )
          : undefined
        : relation.isToMany || source === undefined
          ? variantForRelationType(
              contract,
              owner ?? `${subject} relation '${name}', which`,
              relation.targetModel,
              entryTypeModel(type),
            )
          : undefined;
      const variant = relation.isToMany ? typed : undefined;
      const { where, orderBy, limit, offset } = entry;
      const rowsModel = entryTypeModel(type) ?? relation.targetModel;
      const { query, refine } = relationLoad(
        contract,
        rowsModel,
        { where, orderBy, limit, offset },
        compilation.context && orderableProblem(compilation.context, rowsModel),
      );
      loaded = {
        load: queryLoad(
          'rows',
          name,
          variant,
          query,
          source === undefined ? undefined : () => ({ fn: source, args, at: at + name }),
        ),
        args: relationArgs(relation, { refine, variant }),
      };
      if (source === undefined) {
        staticLoads.set(entry, loaded);
      }
    }
    const ref = refFor(loaded.load);
    const rowArgs = loaded.args;
    // The rows load whole, with what a nested `select` names.
    const target = relation.target;
    const rows: MaybePromise<Compiled> = split
      ? completeValue(
          compileSelect(split, target, {
            ...compilation,
            subject: `${subject} the rows of relation '${name}', whose nested select loads`,
            at: `${at}${name}.`,
            // The rows of a nested `select` are read only through its parent's.
            readsRows: readsRows && (() => false),
          }),
          ({ selection, refs }) => ({
            selection: { ...selection, columns: null, args: rowArgs },
            refs,
          }),
        )
      : { selection: { columns: null, args: rowArgs }, refs: [] };
    return completeValue(rows, ({ selection, refs }) =>
      refSelection(
        refs.length ? { ...ref, beneath: fieldLoads(target, refs) } : ref,
        plans
          ? // The selection mapper reads a type only at a path, which is the field itself when
            // empty.
            field!.nested(
              selection,
              named ? (path ? [...path] : []) : path && [...path],
              named?.name,
            )
          : selection,
      ),
    );
  });
  for (const { relation, compute } of computed) {
    const ref = refFor(
      source === undefined
        ? { kind: 'agg', relation, fn: compute }
        : { kind: 'agg', relation, fn: source, args, at: at + relation },
    );
    parts.push({
      selection: { computed: { [keyOf(ref)]: { kind: 'agg', [COMPUTE]: compute } } },
      ref,
    });
  }
  const settled = parts.some(isThenable) ? Promise.all(parts) : (parts as Planned[]);
  return completeValue(settled, (resolved) => ({
    selection: {
      columns,
      relations: Object.assign({}, ...resolved.map((part) => part.selection.relations)),
      computed: Object.assign({}, ...resolved.map((part) => part.selection.computed)),
    },
    refs: resolved.flatMap((part) => (part.ref ? [part.ref] : [])),
  }));
}

/** Compiles a type-level `select`. Its relations load every column, under their names. */
export function compileTypeSelect(
  contract: AnyContract,
  split: SplitSelect,
  model: PrismaNextModel,
) {
  return (compileSelect(split, model, { contract, args: {}, at: '' }) as Compiled).selection;
}

/**
 * Compiles a static `select` of a type or field, which `subject` reads, when the schema is built,
 * which checks its entries: rows of a variant model with a table of its own load without the
 * columns it inherits, so only a reader `readsRows` accepts can take them, an entry's `type` must
 * be one its relation can return, and its order must be of columns the ORM can order by. Returns
 * where its loads are read, all plain for a type's.
 */
export function checkStaticSelect(
  config: PrismaNextConfig,
  split: SplitSelect,
  model: PrismaNextModel,
  subject: string,
  readsRows: (relation: PrismaNextRelation) => boolean,
): readonly LoadRef[] {
  const { contract, context } = config;
  return (
    compileSelect(split, model, {
      contract,
      context,
      args: {},
      at: '',
      subject,
      readsRows,
    }) as Compiled
  ).refs;
}

/**
 * Compiles a field's `select` for the planner. A select of columns alone becomes a static
 * selection. Anything else becomes a select function that records where the field reads each of
 * its loads. A select function is passed `nestedSelection`, whose entries plan the relation's rows
 * as the field's type.
 */
export function compileFieldSelect(
  config: PrismaNextConfig,
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
  // A static select is checked when the schema is built, so it is split here, not per request.
  const split = typeof raw === 'function' ? undefined : splitSelect(raw, model);
  if (split && split.relations.length === 0 && split.computed.length === 0) {
    return { columns: split.columns };
  }
  return (args, ctx, nested, selected, position) => {
    const returnType = getNamedType(position.field.type);
    const returnModelKey = returnType.extensions?.[PRISMA_NEXT_MODEL] as string | undefined;
    const compile = (select: SplitSelect) =>
      completeValue(
        compileSelect(select, model, {
          contract: config.contract,
          interning: { config, ctx },
          args,
          source: split ? undefined : raw,
          field: { nested, selected, position },
          returnModelKey,
          typeOf,
          at: '',
          // An interface or union reads the rows before any field reloads them.
          readsRows: split
            ? undefined
            : (relation) =>
                returnsRelationRowsAs(
                  relation,
                  isObjectType(returnType) ? 'Object' : 'Other',
                  returnModelKey === undefined
                    ? undefined
                    : getModel(config.contract, returnModelKey),
                ),
        }),
        ({ selection, refs }) => {
          record(position, fieldLoads(model, refs));
          return selection;
        },
      );
    // A select function's result is compiled for a request, which may be the first to see it.
    return split
      ? compile(split)
      : completeValue(
          (raw as Exclude<typeof raw, RawSelect>)(args, ctx, nestedSelectionEntry),
          (value) =>
            checkReturned(value ?? {}, (returned) => compile(splitSelect(returned, model))),
        );
  };
}

/**
 * A type-level relation entry, split, as the data it loads by: its load, the model of its `type`,
 * and its nested `select` likewise, with a relation's `true` as `{}`. An aggregate of the nested
 * `select` is compared by its relation alone.
 */
export function entryDefinition([name, entry, split]: SplitRelation): unknown {
  const { where, orderBy, limit, offset, type } = entry;
  return {
    load: queryLoad('rows', name, undefined, definedQuery({ where, orderBy, limit, offset })),
    type: entryTypeModel(type),
    select: split && {
      ...Object.fromEntries(split.columns.map((column) => [column, true])),
      ...Object.fromEntries(split.relations.map((nested) => [nested[0], entryDefinition(nested)])),
      ...Object.fromEntries(split.computed.map(({ relation }) => [relation, {}])),
    },
  };
}
