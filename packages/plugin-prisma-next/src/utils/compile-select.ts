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

interface FieldPlanning {
  nested: NestedSelection<PrismaNextSelection>;
  selected: SelectedFieldNode;
  position: Position;
}

export interface Planned {
  selection: PrismaNextSelection;
  ref?: LoadRef;
}

export type PlanPage = (
  model: PrismaNextModel,
  relation: PrismaNextRelation,
  name: string,
  field: FieldPlanning,
) => MaybePromise<Planned>;

/** Marks a field `select` entry from `nestedSelection`. */
export const NESTED_SELECTION = Symbol('prismaNextNestedSelection');

/**
 * A relation entry of a `select` (`{}` for `true`). A `nestedSelection` entry plans the rows as
 * `type` (by default the field's type) at `path` beneath the field.
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

function nestedSelectionEntry(
  options: Omit<RelationEntry, typeof NESTED_SELECTION | typeof CONNECTION_PAGE> = {},
): RelationEntry {
  return Object.freeze({ ...options, [NESTED_SELECTION]: true as const });
}

function entryTypeModel(type: unknown): string | undefined {
  return typeof type === 'string' ? type : (type as { modelKey?: string } | undefined)?.modelKey;
}

/**
 * Column names, or an object of columns (`true`), relations (`true` or a `RelationEntry`) and
 * aggregates (`relation: (collection) => ({ key: reducer })`).
 */
export type RawSelect = readonly string[] | Record<string, unknown>;

interface ComputedEntry {
  relation: string;
  compute: Compute;
}

/** Drops options that load nothing different (undefined, or an empty `where`/`orderBy`). */
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
 * A declared order is resolved once; a literal one is checked at build, so only a computed column
 * fails here. The ORM's own selectors go to `orderBy` as they are.
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

/** Both undefined for a query that loads every row. */
export function relationLoad(
  contract: AnyContract,
  modelKey: string,
  value: unknown,
  problem?: Parameters<typeof orderColumns>[3],
) {
  const query = definedQuery(value);
  return { query, refine: query && queryRefinement(contract, modelKey, query, problem) };
}

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

export function refSelection(ref: LoadRef, child: PrismaNextSelection): Planned {
  return { selection: { relations: { [keyOf(ref)]: child } }, ref };
}

export interface SplitSelect {
  columns: string[];
  relations: SplitRelation[];
  computed: ComputedEntry[];
}

type SplitRelation = [name: string, entry: RelationEntry, select: SplitSelect | undefined];

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

export type TypeSelect = SplitSelect & { name: string };

/** The `select`s of a type and its interfaces: the deepest interface first, the type last. */
export function typeSelects(type: {
  readonly extensions?: Readonly<Record<string, unknown>> | null;
}): readonly TypeSelect[] {
  return (type.extensions?.[PRISMA_NEXT_TYPE_SELECTS] as TypeSelect[] | undefined) ?? [];
}

interface SelectCompilation {
  contract: AnyContract;
  /** Set for a field's loads; a type's are all plain. */
  interning?: { config: PrismaNextConfig; ctx: object };
  args: object;
  /**
   * The select function the entries came from. It builds new callbacks on every call, so it
   * identifies an aggregate or callback query together with `args` and the entry's place.
   */
  source?: unknown;
  field?: FieldPlanning;
  returnModelKey?: string;
  typeOf?: (type: unknown) => { name: string; model: string | undefined };
  /** Begins an error about the entries. */
  subject?: string;
  /** Set at build, which checks the columns a static select orders by. */
  context?: PrismaNextExecutionContext<AnyContract>;
  /** The relations from the select's root to the entries, each followed by a dot. */
  at: string;
  /**
   * Whether the reader accepts rows of a variant model with its own table, which load without the
   * columns it inherits.
   */
  readsRows?: (relation: PrismaNextRelation) => boolean;
}

interface Compiled {
  selection: PrismaNextSelection;
  refs: LoadRef[];
}

const staticLoads = new WeakMap<RelationEntry, { load: Load; args: RelationArgs }>();

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
    // To-many rows planned as a variant (not at a path beneath) load that variant. A to-one
    // relation always loads whole and is narrowed when read.
    const { path, type } = entry;
    const plans = NESTED_SELECTION in entry;
    const named = plans && type !== undefined ? typeOf!(type) : undefined;
    let loaded = source === undefined ? staticLoads.get(entry) : undefined;
    if (!loaded) {
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
          ? // The mapper reads a type only at a path; an empty one is the field itself.
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

export function compileTypeSelect(
  contract: AnyContract,
  split: SplitSelect,
  model: PrismaNextModel,
) {
  return (compileSelect(split, model, { contract, args: {}, at: '' }) as Compiled).selection;
}

/** Checks a static `select` at build: variant rows' readers, entry types and orderable columns. */
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
 * A select of columns alone becomes a static selection; anything else a select function that
 * records where the field reads each load.
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
 * A type-level relation entry as the data it loads by, for comparing entries. A nested aggregate
 * is compared by its relation alone.
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
