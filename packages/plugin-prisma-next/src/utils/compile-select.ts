import { completeValue, isThenable, type MaybePromise } from '@pothos/core';
import type { NestedSelection, PathSegment, SelectedFieldNode } from '@pothos/selection-mapper';
import { getNamedType, isInterfaceType, isObjectType } from 'graphql';
import { MAX_RELATION_LOADS, PRISMA_MODEL, PRISMA_TYPE_SELECTS } from '../constants.js';
import type { AnyContract } from '../types/models.js';
import type { PrismaExecutionContext } from '../types/plugin-options.js';
import type { MapperCollection } from './adapter.js';
import type { PrismaConfig } from './config.js';
import { variantForRelationType } from './contract.js';
import {
  isOrderByDecl,
  type OrderByOption,
  orderableProblem,
  orderCollection,
  orderColumns,
} from './cursors.js';
import { checkReturned, InternalError } from './errors.js';
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
  type PrismaModel,
  type PrismaRelation,
  returnsRelationRowsAs,
  sharedVariantRelationError,
} from './model.js';
import {
  COMPUTE,
  type Compute,
  type Narrowing,
  type PrismaSelectFn,
  type PrismaSelection,
  REFINE,
  type RelationArgs,
} from './selections.js';

/** Marks a field `select` entry that loads a connection helper's page of a to-many relation. */
export const CONNECTION_PAGE = Symbol('prismaConnectionPage');

/** Marks the relation of a connection helper's `select` that holds the nodes. */
export const NODE_SELECTION = Symbol('prismaNodeSelection');

interface FieldPlanning {
  nested: NestedSelection<PrismaSelection>;
  selected: SelectedFieldNode;
}

interface CompiledLoad {
  selection: PrismaSelection;
  ref: LoadRef;
}

export type PlanPage = (
  model: PrismaModel,
  relation: PrismaRelation,
  name: string,
  field: FieldPlanning,
) => MaybePromise<CompiledLoad>;

/** Marks a field `select` entry from `nestedSelection`. */
export const NESTED_SELECTION = Symbol('prismaNestedSelection');

/**
 * A relation entry of a `select` (`{}` for `true`). A `nestedSelection` entry plans the rows as
 * `type` (by default the field's type) at `path` beneath the field.
 */
export interface RelationEntry {
  [NODE_SELECTION]?: true;
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
  relation: PrismaRelation,
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

export function refSelection(ref: LoadRef, child: PrismaSelection): CompiledLoad {
  return { selection: { relations: { [keyOf(ref)]: child } }, ref };
}

export interface SplitSelect {
  columns: string[];
  relations: SplitRelation[];
  computed: ComputedEntry[];
}

interface SplitRelation {
  name: string;
  entry: RelationEntry;
  select: SplitSelect | undefined;
}

export function splitSelect(raw: RawSelect, model: PrismaModel): SplitSelect {
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
      throw sharedVariantRelationError(`Select of model '${model.key}'`, key, model);
    }
    if (!model.relations[key]) {
      columns.push(key);
    } else if (typeof value === 'function') {
      computed.push({ relation: key, compute: value as Compute });
    } else {
      const entry = value === true ? {} : (value as RelationEntry);
      relations.push({
        name: key,
        entry,
        select: entry.select && splitSelect(entry.select, model.relations[key]!.target),
      });
    }
  }
  return { columns, relations, computed };
}

export type TypeSelect = SplitSelect & { name: string };

/** The `select`s of a type and its interfaces: the deepest interface first, the type last. */
export function typeSelects(type: {
  readonly extensions?: Readonly<Record<string, unknown>> | null;
}): readonly TypeSelect[] {
  return (type.extensions?.[PRISMA_TYPE_SELECTS] as TypeSelect[] | undefined) ?? [];
}

interface CompilationLocation {
  contract: AnyContract;
  location: string;
  /** The relations from the select's root, each followed by a dot, for callback load identities. */
  at: string;
  /** Whether this reader accepts rows missing a separate-table variant's base columns. */
  readsRows?: (relation: PrismaRelation) => boolean;
}

type SelectCompilation = CompilationLocation &
  (
    | { mode: 'type' }
    | { mode: 'check'; context: PrismaExecutionContext<AnyContract> }
    | {
        mode: 'field';
        config: PrismaConfig;
        ctx: object;
        args: object;
        /** The select callback that builds fresh relation and aggregate callbacks. */
        source?: unknown;
        field: FieldPlanning;
        returnModelKey: string | undefined;
        typeOf: (type: unknown) => { name: string; model: string | undefined };
      }
  );

interface Compiled {
  selection: PrismaSelection;
  refs: LoadRef[];
}

// Keyed by the split entry, not the entry object, which a select can reuse for several relations.
const staticLoads = new WeakMap<SplitRelation, { load: Load; args: RelationArgs }>();

function compileSelect(
  { columns, relations, computed }: SplitSelect,
  model: PrismaModel,
  compilation: SelectCompilation,
): MaybePromise<Compiled> {
  const { contract, location, at, readsRows } = compilation;
  const identity =
    compilation.mode === 'field' && compilation.source !== undefined
      ? { fn: compilation.source, args: compilation.args }
      : undefined;
  const refFor = (load: Load): LoadRef =>
    compilation.mode === 'field'
      ? refOf(compilation.config, compilation.ctx, model, load)
      : { load };
  const parts = relations.map((splitEntry): MaybePromise<CompiledLoad> => {
    const { name, entry, select: split } = splitEntry;
    const relation = model.relations[name]!;
    if (
      readsRows &&
      !entry[CONNECTION_PAGE] &&
      relation.targetVariantModel?.sharesTable === false &&
      !readsRows(relation)
    ) {
      throw ownTableVariantRowsError(location, name, relation);
    }
    const page = entry[CONNECTION_PAGE];
    if (page && compilation.mode === 'field') {
      return page(model, relation, name, compilation.field);
    }
    // To-many rows planned as a variant (not at a path beneath) load that variant. A to-one
    // relation always loads whole and is narrowed when read.
    const { path, type } = entry;
    const plans = compilation.mode === 'field' && NESTED_SELECTION in entry;
    const named = plans && type !== undefined ? compilation.typeOf(type) : undefined;
    let loaded = identity === undefined ? staticLoads.get(splitEntry) : undefined;
    if (!loaded) {
      const typed = plans
        ? relation.isToMany && !path?.length
          ? variantForRelationType(
              contract,
              location,
              relation.targetModel,
              named ? named.model : compilation.returnModelKey,
            )
          : undefined
        : relation.isToMany || identity === undefined
          ? variantForRelationType(
              contract,
              `${location}.${name}`,
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
        compilation.mode === 'check' ? orderableProblem(compilation.context, rowsModel) : undefined,
      );
      loaded = {
        load: queryLoad(
          'rows',
          name,
          variant,
          query,
          identity && (() => ({ ...identity, at: at + name })),
        ),
        args: relationArgs(relation, { refine, variant }),
      };
      if (identity === undefined) {
        staticLoads.set(splitEntry, loaded);
      }
    }
    const ref = refFor(loaded.load);
    const rowArgs = loaded.args;
    const target = relation.target;
    const rows: MaybePromise<Compiled> = split
      ? completeValue(
          compileSelect(split, target, {
            ...compilation,
            location: `${location}.${name}`,
            at: `${at}${name}.`,
            // The rows of a nested `select` are read only through its parent's.
            readsRows: readsRows && (() => false),
          }),
          ({ selection, refs }) => ({
            selection: { ...selection, columns: plans ? selection.columns : null, args: rowArgs },
            refs,
          }),
        )
      : { selection: { columns: null, args: rowArgs }, refs: [] };
    return completeValue(rows, ({ selection, refs }) =>
      refSelection(
        refs.length ? { ...ref, beneath: fieldLoads(target, refs) } : ref,
        plans
          ? // The mapper reads a type only at a path; an empty one is the field itself.
            compilation.field.nested(
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
      identity === undefined
        ? { kind: 'agg', relation, fn: compute }
        : { kind: 'agg', relation, ...identity, at: at + relation },
    );
    parts.push({
      selection: {
        computed: {
          [keyOf(ref)]:
            compilation.mode === 'field'
              ? compilation.config.adapter.aggregate(
                  compilation.config.collection(compilation.ctx, model.key),
                  model,
                  relation,
                  compute,
                )
              : { kind: 'agg', [COMPUTE]: compute },
        },
      },
      ref,
    });
  }
  const settled = parts.some(isThenable) ? Promise.all(parts) : (parts as CompiledLoad[]);
  return completeValue(settled, (resolved) => {
    const computed: NonNullable<PrismaSelection['computed']> = Object.assign(
      {},
      ...resolved.map((part) => part.selection.computed),
    );
    const reducers = Object.values(computed).reduce((sum, value) => sum + (value.size ?? 1), 0);
    if (compilation.mode === 'field' && reducers > MAX_RELATION_LOADS) {
      throw new InternalError(
        `A field's select loads ${reducers} aggregate reducers at one level, and the limit is ${MAX_RELATION_LOADS}. Split them across fields.`,
      );
    }
    return {
      selection: {
        columns,
        relations: Object.assign({}, ...resolved.map((part) => part.selection.relations)),
        computed,
      },
      refs: resolved.map((part) => part.ref),
    };
  });
}

export function compileTypeSelect(contract: AnyContract, split: SplitSelect, model: PrismaModel) {
  return (
    compileSelect(split, model, {
      mode: 'type',
      contract,
      location: `Model '${model.key}' select`,
      at: '',
    }) as Compiled
  ).selection;
}

/** Checks a static `select` at build: variant rows' readers, entry types and orderable columns. */
export function checkStaticSelect(
  config: PrismaConfig,
  split: SplitSelect,
  model: PrismaModel,
  location: string,
  readsRows: (relation: PrismaRelation) => boolean,
): readonly LoadRef[] {
  const { contract, context } = config;
  return (
    compileSelect(split, model, {
      mode: 'check',
      contract,
      context,
      at: '',
      location,
      readsRows,
    }) as Compiled
  ).refs;
}

/**
 * A select of columns alone becomes a static selection; anything else a select function that
 * records where the field reads each load.
 */
export function compileFieldSelect(
  config: PrismaConfig,
  raw:
    | RawSelect
    | ((
        args: object,
        ctx: object,
        nestedSelection: typeof nestedSelectionEntry,
      ) => MaybePromise<RawSelect | null | undefined>),
  model: PrismaModel,
  typeOf: (type: unknown) => { name: string; model: string | undefined },
): PrismaSelection | PrismaSelectFn {
  // A static select is checked when the schema is built, so it is split here, not per request.
  const split = typeof raw === 'function' ? undefined : splitSelect(raw, model);
  if (split && split.relations.length === 0 && split.computed.length === 0) {
    return { columns: split.columns };
  }
  return (args, ctx, nested, selected, position) => {
    const returnType = getNamedType(position.field.type);
    const returnModelKey = returnType.extensions?.[PRISMA_MODEL] as string | undefined;
    const compile = (select: SplitSelect) =>
      completeValue(
        compileSelect(select, model, {
          mode: 'field',
          contract: config.contract,
          config,
          ctx,
          location: `Field '${position.type.name}.${position.field.name}' select`,
          args,
          source: split ? undefined : raw,
          field: { nested, selected },
          returnModelKey,
          typeOf,
          at: '',
          // An interface or union reads the rows before any field reloads them.
          readsRows: split
            ? undefined
            : (relation) =>
                returnsRelationRowsAs(
                  relation,
                  isObjectType(returnType)
                    ? 'Object'
                    : isInterfaceType(returnType)
                      ? 'Interface'
                      : 'Other',
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

/** A type-level relation entry as the data it loads by, for comparing entries. */
export function entryDefinition({ name, entry, select: split }: SplitRelation): unknown {
  const { where, orderBy, limit, offset, type } = entry;
  return {
    load: queryLoad('rows', name, undefined, definedQuery({ where, orderBy, limit, offset })),
    type: entryTypeModel(type),
    select: split && {
      ...Object.fromEntries(split.columns.map((column) => [column, true])),
      ...Object.fromEntries(
        split.relations.map((nested) => [nested.name, entryDefinition(nested)]),
      ),
    },
  };
}
