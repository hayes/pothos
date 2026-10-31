import { isThenable, PothosValidationError } from '@pothos/core';
import {
  Adapter,
  deepEqual,
  type MergeOptions,
  type NestedSelection,
  type Plan,
  type SelectFn,
  type WalkedType,
} from '@pothos/selection-mapper';
import { type GraphQLField, type GraphQLNamedType, getNamedType } from 'graphql';
import { PRISMA_NEXT_FIELD_SELECT, PRISMA_NEXT_MODEL, PRISMA_NEXT_SELECT } from '../constants.js';
import type { AnyContract } from '../types.js';
import { relationVariant } from './contract.js';
import {
  getIdentityFields,
  getModel,
  type PrismaNextModel,
  type PrismaNextRelation,
} from './model.js';

type TypeLevelConflict = { kind: 'relation'; name: string } | { kind: 'extra'; name: string };

/**
 * Loose shape of orm-client's `Collection`: the typed one collapses `.select(name)` to
 * `keyof never` when the model is only known at runtime.
 */
export interface MapperCollection {
  select(...fields: string[]): MapperCollection;
  include(name: string, refine?: (rel: MapperCollection) => MapperCollection): MapperCollection;
  combine(spec: Record<string, unknown>): MapperCollection;
  count(): unknown;
  sum(field: string): unknown;
  avg(field: string): unknown;
  min(field: string): unknown;
  max(field: string): unknown;
  where(input: unknown): MapperCollection;
  orderBy(input: unknown): MapperCollection;
  /** Keyset seek strictly past the boundary in the `orderBy` direction; requires a prior `orderBy`. */
  cursor(cursorValues: Record<string, unknown>): MapperCollection;
  limit(n: number): MapperCollection;
  offset(n: number): MapperCollection;
  variant?(value: string): MapperCollection;
  readonly state?: { readonly variantValue?: unknown };
}

export type PrismaNextArgs = Record<string, unknown>;

export type PrismaNextRefine = (rel: MapperCollection) => MapperCollection | null | undefined;

/** Returns combine entries for a relation; each is emitted under `<alias>:<key>`. */
export type PrismaNextSpecFn = (sub: MapperCollection, ctx: object) => Record<string, unknown>;

export interface PrismaNextFnEntry {
  /** The field definition the callback came from; callbacks are recompiled per path. */
  source?: object;
  fn: PrismaNextSpecFn;
  alias?: string;
  args?: PrismaNextArgs;
}

/** A relation branch answers to combine slot `<alias>:<slot>` (`slot` defaults to the relation). */
export interface PrismaNextSpec {
  source?: object;
  /** Slot namespace when the walker gives no field key (`:object:<Type>` for type selects). */
  alias?: string;
  slot?: string;
  /** Consumers of one slot must agree on these. */
  args?: PrismaNextArgs;
  refine?: PrismaNextRefine;
  /** Discriminator value this level is narrowed to; relations declared on a variant need it. */
  variant?: string;
  /**
   * Set when the relation targets a variant model: the ORM loads it through that model's own
   * accessor, which can't be narrowed or include relations declared on the base.
   */
  variantModel?: string;
  columns?: readonly string[];
  relations?: Record<string, PrismaNextRelationEntry | PrismaNextRelationEntry[]>;
}

/** An array holds several consumers from one field (a connection's rows and its count). */
export type PrismaNextRelationEntry = true | PrismaNextSpec | PrismaNextSpecFn | PrismaNextFnEntry;

export type PrismaNextSelectFn = SelectFn<PrismaNextSpec>;
export type PrismaNextPlan = Plan<PrismaNextModel, PrismaNextSpec, PrismaNextNode>;

export interface PrismaNextBranch {
  source?: object;
  alias: string;
  slot: string;
  args: PrismaNextArgs;
  refine?: PrismaNextRefine;
  node: PrismaNextNode;
}

export interface PrismaNextFn {
  source?: object;
  alias: string;
  fn: PrismaNextSpecFn;
  args: PrismaNextArgs;
}

export interface PrismaNextRelationAcc {
  meta: PrismaNextRelation;
  /** Keyed `<alias>:<slot>`. */
  branches: Map<string, PrismaNextBranch>;
  /** Keyed by alias: one field adds one function to a relation. */
  functions: Map<string, PrismaNextFn>;
}

export interface PrismaNextNode {
  model: PrismaNextModel;
  columns: Set<string>;
  relations: Map<string, PrismaNextRelationAcc>;
  /** Set by `merge` under `options.asQuery`; the parent's branch carries them. */
  slot?: string;
  refine?: PrismaNextRefine;
  variant?: string;
  variantModel?: string;
}

export function createPrismaNextNode(model: PrismaNextModel): PrismaNextNode {
  return { model, columns: new Set(), relations: new Map() };
}

// `:` can't appear in a GraphQL name, so combine keys never collide with aliases or relation names.
const COMBINE_SEPARATOR = ':';
const OBJECT_LEVEL_PREFIX = `${COMBINE_SEPARATOR}object${COMBINE_SEPARATOR}`;

export function objectLevelFieldAlias(typeName: string): string {
  return `${OBJECT_LEVEL_PREFIX}${typeName}`;
}

export function selectBranchAlias(fieldAlias: string, specKey: string): string {
  return `${fieldAlias}${COMBINE_SEPARATOR}${specKey}`;
}

export function fieldAliasPrefix(fieldAlias: string): string {
  return `${fieldAlias}${COMBINE_SEPARATOR}`;
}

function getOrCreateRelation(node: PrismaNextNode, name: string): PrismaNextRelationAcc {
  let relation = node.relations.get(name);

  if (!relation) {
    const meta = node.model.relations[name];

    if (!meta) {
      throw new PothosValidationError(
        `Relation "${name}" does not exist on model ${node.model.name}`,
      );
    }

    relation = { meta, branches: new Map(), functions: new Map() };
    node.relations.set(name, relation);

    // prisma-next stitches nested includes on the parent-side FK columns.
    for (const column of meta.localFields) {
      node.columns.add(column);
    }
  }

  return relation;
}

/**
 * The walker applies a field once per field node, so a repeated slot is unioned. The same slot
 * with different arguments (one alias under both `edges.node` and `nodes`) can't share an include.
 */
function addBranch(
  relation: PrismaNextRelationAcc,
  name: string,
  alias: string,
  spec: PrismaNextSpec,
) {
  const slot = spec.slot ?? name;
  const id = selectBranchAlias(alias, slot);
  const args = spec.args ?? {};
  let branch = relation.branches.get(id);

  // The ORM allows one include per to-one relation, so every consumer must agree on its query.
  if (!relation.meta.isToMany) {
    for (const existing of relation.branches.values()) {
      if (
        !deepEqual(existing.args, args) ||
        !sameBranchRefine(existing, spec) ||
        existing.node.variant !== spec.variant
      ) {
        throw new SelectionConflict(
          name,
          `Relation "${name}" is to-one and has incompatible queries under aliases "${selectBranchAlias(existing.alias, existing.slot)}" and "${id}". ` +
            'The ORM does not support independent include branches for to-one relations (ORM.INCLUDE_UNSUPPORTED).',
        );
      }
    }
  }

  if (!branch) {
    branch = {
      alias,
      slot,
      args,
      refine: spec.refine,
      source: spec.source,
      node: createPrismaNextNode(relation.meta.target),
    };
    relation.branches.set(id, branch);
  } else if (
    !deepEqual(branch.args, args) ||
    !sameBranchRefine(branch, spec) ||
    branch.node.variant !== spec.variant
  ) {
    throw new SelectionConflict(
      name,
      `Relation "${name}" is selected twice under alias "${id}" with different queries. Alias one of the selections.`,
    );
  } else {
    branch.refine ??= spec.refine;
  }

  mergeSpec(branch.node, spec, alias);
}

class SelectionConflict extends PothosValidationError {
  constructor(
    readonly relation: string,
    message: string,
  ) {
    super(message);
  }
}

/** Consumers of a shared to-one include only meet at emission, so check their merged children. */
function validateIncludes(node: PrismaNextNode): void {
  for (const relation of node.relations.values()) {
    if (!relation.meta.isToMany && relation.branches.size > 1 && relation.functions.size === 0) {
      const shared = createPrismaNextNode(relation.meta.target);
      for (const branch of relation.branches.values()) {
        mergeSpec(
          shared,
          scopeChildConsumers({ ...serializeNode(branch.node), alias: branch.alias }),
          branch.alias,
        );
      }
      validateIncludes(shared);
    } else {
      for (const branch of relation.branches.values()) {
        validateIncludes(branch.node);
      }
    }
  }
}

/**
 * The first relation the ORM can't include where it sits: a variant's relation on a level not
 * narrowed to that variant, or a base relation beneath a relation targeting a variant model.
 */
export function variantRelationProblem(
  spec: PrismaNextSpec,
  model: PrismaNextModel,
  narrowed = spec.variant,
  variantModel = spec.variantModel,
): { relation: string; message: string } | undefined {
  for (const [name, entries] of Object.entries(spec.relations ?? {})) {
    const meta = model.relations[name];
    if (!meta) {
      continue;
    }
    if (meta.variant !== undefined && meta.variant !== narrowed) {
      return {
        relation: name,
        message:
          `Relation "${name}" is declared on variant '${meta.variant}' of model ${model.name}, so it loads only from a collection narrowed with .variant('${meta.variant}'). ` +
          `Return orm.${model.name}.variant('${meta.variant}') (or a relation typed as that variant), or set prismaNext.collections so the field loads separately.`,
      };
    }
    if (variantModel !== undefined && meta.variant === undefined) {
      return {
        relation: name,
        message:
          `Relation "${name}" is inherited from model ${model.name} and can't be included beneath a relation to variant model '${variantModel}': ` +
          'the ORM loads those rows through the variant model, which only has its own relations. Set prismaNext.collections so the field loads separately.',
      };
    }
    for (const entry of Array.isArray(entries) ? entries : [entries]) {
      if (entry === true || typeof entry === 'function' || 'fn' in entry) {
        continue;
      }
      const problem = variantRelationProblem(
        entry,
        meta.target,
        entry.variant ?? meta.targetVariant?.value,
        entry.variantModel ?? meta.targetVariant?.model,
      );
      if (problem) {
        return problem;
      }
    }
  }
  return undefined;
}

/**
 * Callbacks are recompiled per path (a connection's `nodes` and `edges.node`), so duplicates are
 * matched on their source definition and arguments rather than function identity.
 */
function addFunction(
  relation: PrismaNextRelationAcc,
  name: string,
  alias: string,
  fn: PrismaNextSpecFn,
  args: PrismaNextArgs,
  source?: object,
) {
  const existing = relation.functions.get(alias);

  if (!existing) {
    relation.functions.set(alias, { alias, fn, args, source });
  } else if (
    !deepEqual(existing.args, args) ||
    (existing.source ?? existing.fn) !== (source ?? fn)
  ) {
    throw new SelectionConflict(
      name,
      `Relation "${name}" is selected twice under alias "${alias}" with different queries. Alias one of the selections.`,
    );
  }
}

function mergeSpec(node: PrismaNextNode, spec: PrismaNextSpec, alias: string | undefined) {
  if (spec.variant !== undefined) {
    if (node.variant !== undefined && node.variant !== spec.variant) {
      throw new SelectionConflict(
        '',
        `Cannot narrow one selection to both variant "${node.variant}" and "${spec.variant}".`,
      );
    }
    node.variant = spec.variant;
  }

  if (spec.variantModel !== undefined) {
    node.variantModel = spec.variantModel;
  }

  if (spec.columns) {
    for (const column of spec.columns) {
      node.columns.add(column);
    }
  }

  if (!spec.relations) {
    return;
  }

  for (const name of Object.keys(spec.relations)) {
    const entries = spec.relations[name];
    const relation = getOrCreateRelation(node, name);

    for (const entry of Array.isArray(entries) ? entries : [entries]) {
      if (isThenable(entry)) {
        throw new PothosValidationError(
          `Relation "${name}" was given a promise. Await nestedSelection() inside an async selection function.`,
        );
      }

      if (entry === true) {
        addBranch(relation, name, requireAlias(name, alias), {});
      } else if (typeof entry === 'function') {
        addFunction(relation, name, requireAlias(name, alias), entry, {});
      } else if ('fn' in entry) {
        addFunction(
          relation,
          name,
          requireAlias(name, entry.alias ?? alias),
          entry.fn,
          entry.args ?? {},
          entry.source,
        );
      } else {
        addBranch(relation, name, requireAlias(name, entry.alias ?? alias), entry);
      }
    }
  }
}

function requireAlias(name: string, alias: string | undefined): string {
  if (alias === undefined) {
    throw new PothosValidationError(
      `Relation "${name}" was merged without a slot: the walker gave no field key and the entry carries no alias.`,
    );
  }

  return alias;
}

function serializeNode(node: PrismaNextNode): PrismaNextSpec {
  const spec: PrismaNextSpec = {};

  if (node.slot) {
    spec.slot = node.slot;
  }

  if (node.refine) {
    spec.refine = node.refine;
  }

  if (node.variant !== undefined) {
    spec.variant = node.variant;
  }

  if (node.variantModel !== undefined) {
    spec.variantModel = node.variantModel;
  }

  if (node.columns.size > 0) {
    spec.columns = [...node.columns];
  }

  if (node.relations.size === 0) {
    return spec;
  }

  spec.relations = {};

  for (const [name, relation] of node.relations) {
    const entries: PrismaNextRelationEntry[] = [];

    for (const branch of relation.branches.values()) {
      entries.push({
        alias: branch.alias,
        slot: branch.slot,
        args: branch.args,
        ...(branch.source ? { source: branch.source } : {}),
        ...(branch.refine ? { refine: branch.refine } : {}),
        ...serializeNode(branch.node),
      });
    }

    for (const fn of relation.functions.values()) {
      entries.push({
        alias: fn.alias,
        fn: fn.fn,
        args: fn.args,
        ...(fn.source ? { source: fn.source } : {}),
      });
    }

    spec.relations[name] = entries.length === 1 ? entries[0] : entries;
  }

  return spec;
}

/** Column names, or an object of columns (`true`) and relations (`true`, a refine, or a fn). */
export type RawSelect = readonly string[] | Record<string, unknown>;

interface DeclarativeRefineSpec {
  where?: unknown | ((accessor: unknown) => unknown);
  orderBy?: (accessor: unknown) => unknown;
  limit?: number;
  offset?: number;
}

function isDeclarativeRefineSpec(value: unknown): value is DeclarativeRefineSpec {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const o = value as Record<string, unknown>;
  const hasAny = 'where' in o || 'orderBy' in o || 'limit' in o || 'offset' in o;
  if (!hasAny) {
    return false;
  }
  for (const k of Object.keys(o)) {
    if (k !== 'where' && k !== 'orderBy' && k !== 'limit' && k !== 'offset') {
      return false;
    }
  }
  return true;
}

// Compiled refines keep their spec so equal declarative refines compare equal.
const declarativeRefines = new WeakMap<PrismaNextRefine, DeclarativeRefineSpec>();

function sameRefine(a: PrismaNextRefine | undefined, b: PrismaNextRefine | undefined): boolean {
  return (
    a === b ||
    !!(
      a &&
      b &&
      declarativeRefines.has(a) &&
      declarativeRefines.has(b) &&
      deepEqual(declarativeRefines.get(a), declarativeRefines.get(b))
    )
  );
}

function sameBranchRefine(
  branch: Pick<PrismaNextSpec, 'source' | 'refine'>,
  spec: PrismaNextSpec,
): boolean {
  return (
    sameRefine(branch.refine, spec.refine) ||
    // A callback `query` returns a new closure on every walk; the same source means the same query.
    !!(branch.source && branch.source === spec.source && branch.refine && spec.refine)
  );
}

export function compileDeclarativeRefine(spec: DeclarativeRefineSpec): PrismaNextRefine {
  const refine: PrismaNextRefine = (rel) => {
    let r = rel;
    if (spec.where !== undefined) {
      r = r.where(spec.where);
    }
    if (spec.orderBy !== undefined) {
      r = r.orderBy(spec.orderBy);
    }
    if (spec.limit !== undefined) {
      r = r.limit(spec.limit);
    }
    if (spec.offset !== undefined) {
      r = r.offset(spec.offset);
    }
    return r;
  };
  declarativeRefines.set(refine, spec);
  return refine;
}

interface CompileOptions {
  model: PrismaNextModel | undefined;
  /** Used in error messages. */
  owner: string;
  label: string;
  alias?: string;
  args?: PrismaNextArgs;
  branch?: (relation: PrismaNextRelation, query: PrismaNextSpec | undefined) => PrismaNextSpec;
  fn?: (value: (...args: unknown[]) => unknown) => PrismaNextSpecFn;
}

export function compileSelect(raw: RawSelect, options: CompileOptions): PrismaNextSpec {
  const columns: string[] = [];
  const spec: PrismaNextSpec = options.alias === undefined ? {} : { alias: options.alias };

  if (Array.isArray(raw)) {
    for (const col of raw) {
      if (typeof col === 'string') {
        columns.push(col);
      }
    }

    spec.columns = columns;

    return spec;
  }

  const { model, owner, label } = options;
  const relations: Record<string, PrismaNextRelationEntry> = {};
  let hasRelations = false;

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value === false || value === undefined || value === null) {
      continue;
    }

    const relation = model?.relations[key];
    const isKnownColumn = model?.columns?.has(key) ?? true;

    if (value === true) {
      if (relation) {
        relations[key] = options.branch
          ? { ...options.branch(relation, undefined), args: options.args ?? {} }
          : true;
        hasRelations = true;
      } else if (isKnownColumn) {
        columns.push(key);
      } else {
        throw new PothosValidationError(
          `${label}: '${key}' is not a column or relation on ${owner}. ` +
            'Check for a typo, or register the field via the contract.',
        );
      }
    } else if (typeof value === 'function') {
      if (!relation) {
        throw new PothosValidationError(
          `${label}: '${key}' has a function value but is not a relation on ${owner}.`,
        );
      }

      relations[key] = options.fn
        ? { fn: options.fn(value as (...args: unknown[]) => unknown), args: options.args ?? {} }
        : (value as PrismaNextSpecFn);
      hasRelations = true;
    } else if (isDeclarativeRefineSpec(value)) {
      if (!relation) {
        throw new PothosValidationError(
          `${label}: '${key}' has a { where, limit, offset, orderBy } entry but is not a relation on ${owner}.`,
        );
      }

      const refine = compileDeclarativeRefine(value);

      relations[key] = {
        ...(options.branch ? options.branch(relation, { refine }) : { refine }),
        args: options.args ?? {},
      };
      hasRelations = true;
    } else {
      throw new PothosValidationError(
        `${label}: '${key}' has an unrecognized value shape. Use \`true\`, ` +
          '`{ where?, orderBy?, limit?, offset? }`, or a function ' +
          '`(sub, args, ctx) => spec`.',
      );
    }
  }

  if (columns.length > 0) {
    spec.columns = columns;
  }

  if (hasRelations) {
    spec.relations = relations;
  }

  return spec;
}

function isStaticColumns(raw: Record<string, unknown>, model: PrismaNextModel | undefined) {
  return (
    Object.values(raw).every((value) => value === true || !value) &&
    Object.keys(raw).every((key) => !model?.relations[key])
  );
}

interface FieldSelectExtensions {
  pothosExposedField?: unknown;
  pothosOptions?: { select?: unknown };
  pothosIndirectInclude?: { getType: () => string; path?: unknown[]; paths?: unknown[] };
  [PRISMA_NEXT_FIELD_SELECT]?: PrismaNextSpec | PrismaNextSelectFn;
}

/** Tags entries with the type that declared them, so recompiled callbacks still compare equal. */
function withSelectionSource(spec: PrismaNextSpec, source: object): PrismaNextSpec {
  if (!spec.relations) {
    return spec;
  }
  const identifyEntry = (entry: PrismaNextRelationEntry): PrismaNextRelationEntry =>
    typeof entry === 'function'
      ? { fn: entry, source }
      : entry === true
        ? entry
        : { ...entry, source: entry.source ?? source };
  return {
    ...spec,
    relations: Object.fromEntries(
      Object.entries(spec.relations).map(([name, entries]) => [
        name,
        Array.isArray(entries) ? entries.map(identifyEntry) : identifyEntry(entries),
      ]),
    ),
  };
}

function compileFieldSelection(
  field: GraphQLField<unknown, unknown>,
  parentModel: PrismaNextModel | undefined,
  adapter: PrismaNextAdapter,
): PrismaNextSpec | PrismaNextSelectFn | undefined {
  const modelFor = (type: GraphQLNamedType) => adapter.modelFor(type);

  const ext = (field.extensions ?? {}) as FieldSelectExtensions;

  if (ext[PRISMA_NEXT_FIELD_SELECT]) {
    return ext[PRISMA_NEXT_FIELD_SELECT];
  }

  const exposed = typeof ext.pothosExposedField === 'string' ? [ext.pothosExposedField] : [];
  const raw = ext.pothosOptions?.select as
    | RawSelect
    | ((...args: unknown[]) => unknown)
    | undefined;
  // Undefined for scalars and for wrappers such as errors-plugin result types.
  const returnModel = modelFor(getNamedType(field.type));
  const returnModelKey = getNamedType(field.type).extensions?.[PRISMA_NEXT_MODEL] as
    | string
    | undefined;
  const indirect = ext.pothosIndirectInclude;
  const owner = parentModel?.name ?? '(unknown model)';

  const withColumns = (spec: PrismaNextSpec, extra: readonly string[]): PrismaNextSpec =>
    extra.length === 0 ? spec : { ...spec, columns: [...extra, ...(spec.columns ?? [])] };

  // t.variant: walk the variant type's selection on the same row.
  if (indirect && !indirect.path?.length && !indirect.paths?.length) {
    const forced = Array.isArray(raw) ? (raw as readonly string[]) : [];

    return (_args, _ctx, nested, _selected, position) => {
      const selection = nested(true) as PrismaNextSpec | PromiseLike<PrismaNextSpec>;
      const finish = (spec: PrismaNextSpec) =>
        withColumns(
          scopeChildConsumers({
            ...spec,
            alias: position.node.alias?.value ?? position.node.name.value,
          }),
          [...exposed, ...forced],
        );
      return isThenable(selection) ? Promise.resolve(selection).then(finish) : finish(selection);
    };
  }

  if (raw === undefined) {
    return exposed.length > 0 ? { columns: exposed } : undefined;
  }

  const compile = (
    value: RawSelect,
    args: PrismaNextArgs,
    nested: NestedSelection<PrismaNextSpec>,
  ): PrismaNextSpec | Promise<PrismaNextSpec> => {
    const pending: Promise<void>[] = [];
    const branches: PrismaNextSpec[] = [];
    let index = 0;
    let replay = false;
    const build = () =>
      withColumns(
        compileSelect(value, {
          model: parentModel,
          owner,
          label: 'select',
          args,
          // A return type backed by a different model than the relation's gets a bare include.
          branch: (relation, query) => {
            const slot = index++;
            if (replay) {
              return branches[slot];
            }
            // A relation to a hierarchy's base, typed as one of its variants, loads that variant.
            const variant =
              returnModel === relation.target
                ? relationVariant(
                    adapter.contract,
                    `Field '${field.name}'`,
                    relation.targetModel,
                    returnModelKey,
                  )
                : undefined;
            const target = relation.targetVariant;
            const seed: PrismaNextSpec | undefined = target
              ? { ...query, variant: target.value, variantModel: target.model }
              : variant !== undefined
                ? { ...query, variant }
                : query;
            const selection = (
              returnModel && returnModel !== relation.target ? (query ?? {}) : nested(seed)
            ) as PrismaNextSpec | PromiseLike<PrismaNextSpec>;
            if (isThenable(selection)) {
              pending.push(
                Promise.resolve(selection).then((spec) => {
                  branches[slot] = spec;
                }),
              );
              return {};
            }
            branches[slot] = selection;
            return selection;
          },
          fn: (value) => (sub, fnCtx) =>
            (value as PrismaNextSpecFn & ((s: unknown, a: unknown, c: unknown) => never))(
              sub,
              args,
              fnCtx,
            ) as Record<string, unknown>,
        }),
        exposed,
      );
    const spec = build();
    // Rebuild with the settled branches rather than calling `nested` again.
    return pending.length === 0
      ? spec
      : Promise.all(pending).then(() => {
          replay = true;
          index = 0;
          return build();
        });
  };

  if (typeof raw === 'function') {
    return (args, ctx, nested) => {
      const value = raw(args, ctx) as RawSelect | PromiseLike<RawSelect> | null | undefined;

      return isThenable(value)
        ? Promise.resolve(value).then((resolved) =>
            compile(resolved ?? {}, args as PrismaNextArgs, nested),
          )
        : compile(value ?? {}, args as PrismaNextArgs, nested);
    };
  }

  if (Array.isArray(raw) || isStaticColumns(raw as Record<string, unknown>, parentModel)) {
    return withColumns(compileSelect(raw, { model: parentModel, owner, label: 'select' }), exposed);
  }

  return (args, _ctx, nested) => compile(raw, args as PrismaNextArgs, nested);
}

/** Relation entries that conflict with what's already merged are set aside in `deferred`. */
function mergeTypeEntries(
  node: PrismaNextNode,
  spec: PrismaNextSpec,
  alias: string,
  typeName: string,
  deferred: Map<string, PrismaNextSpec['relations']>,
) {
  mergeSpec(node, { columns: spec.columns }, alias);
  for (const [name, entry] of Object.entries(spec.relations ?? {})) {
    const copy = createPrismaNextNode(node.model);
    try {
      mergeSpec(copy, serializeNode(node), alias);
      mergeSpec(copy, { relations: { [name]: entry } }, alias);
      validateIncludes(copy);
      mergeSpec(node, { relations: { [name]: entry } }, alias);
    } catch (error) {
      if (!(error instanceof SelectionConflict)) {
        throw error;
      }
      deferred.set(typeName, { ...deferred.get(typeName), [name]: entry });
    }
  }
}

function compileTypeSelection(
  type: GraphQLNamedType,
  model: PrismaNextModel | undefined,
  deferred?: Map<string, PrismaNextSpec['relations']>,
): PrismaNextSpec | undefined {
  if (!model) {
    return undefined;
  }

  const node = createPrismaNextNode(model);
  const visited = new Set<GraphQLNamedType>();
  let hasSelection = false;
  const collect = (current: GraphQLNamedType) => {
    if (visited.has(current)) {
      return;
    }
    visited.add(current);
    // Inherited fields keep their interface's resolver and slot, so interface selections are
    // loaded too. With a loader for conflicts, the concrete type's own selection goes first.
    const interfaces = 'getInterfaces' in current ? current.getInterfaces() : [];
    if (!deferred) {
      interfaces.forEach(collect);
    }
    const raw = current.extensions?.[PRISMA_NEXT_SELECT] as RawSelect | undefined;
    if (raw) {
      hasSelection = true;
      const alias = objectLevelFieldAlias(current.name);
      const spec = withSelectionSource(
        compileSelect(raw, {
          model,
          owner: current.name,
          label: 'prismaObject select',
          alias,
          fn: (value) => (sub, ctx) => value(sub, {}, ctx) as Record<string, unknown>,
        }),
        current,
      );
      if (deferred) {
        mergeTypeEntries(node, spec, alias, current.name, deferred);
      } else {
        mergeSpec(node, spec, alias);
      }
    }
    if (deferred) {
      interfaces.forEach(collect);
    }
  };
  collect(type);
  return hasSelection ? serializeNode(node) : undefined;
}

/**
 * To-many consumers get separate combine slots. To-one consumers must share a compatible query;
 * with `fallback` (a collections provider) conflicting fields are loaded in a separate batch.
 */
export class PrismaNextAdapter extends Adapter<PrismaNextModel, PrismaNextSpec, PrismaNextNode> {
  override readonly skipDeferredFragments: boolean;
  private readonly typeSelections = new WeakMap<GraphQLNamedType, PrismaNextSpec | null>();
  private readonly typePrerequisites = new WeakMap<GraphQLNamedType, PrismaNextSpec | null>();
  /** Interface selections that conflict with the concrete type's, by interface name. */
  private readonly deferredPrerequisites = new WeakMap<
    GraphQLNamedType,
    Map<string, PrismaNextSpec['relations']>
  >();
  private readonly fieldSelections = new WeakMap<
    GraphQLField<unknown, unknown>,
    PrismaNextSpec | PrismaNextSelectFn | null
  >();

  constructor(
    readonly contract: AnyContract,
    readonly fallback = false,
  ) {
    super();
    this.skipDeferredFragments = fallback;
  }

  modelFor(type: GraphQLNamedType): PrismaNextModel | undefined {
    const name = type.extensions?.[PRISMA_NEXT_MODEL] as string | undefined;

    return name === undefined ? undefined : getModel(this.contract, name);
  }

  typeSelection(type: GraphQLNamedType): PrismaNextSpec | undefined {
    let spec = this.typeSelections.get(type);

    if (spec === undefined) {
      const model = this.modelFor(type);
      spec = this.typePrerequisite(type) ?? null;
      if (this.fallback && model) {
        spec = {
          ...spec,
          columns: [...(spec?.columns ?? []), ...getIdentityFields(this.contract, model.name)],
        };
      }
      this.typeSelections.set(type, spec);
    }

    return spec ?? undefined;
  }

  /** `typeSelection` without the identity columns added for fallback loading. */
  typePrerequisite(type: GraphQLNamedType): PrismaNextSpec | undefined {
    let spec = this.typePrerequisites.get(type);

    if (spec === undefined) {
      const deferred = this.fallback ? new Map<string, PrismaNextSpec['relations']>() : undefined;
      spec = compileTypeSelection(type, this.modelFor(type), deferred) ?? null;
      this.typePrerequisites.set(type, spec);
      if (deferred?.size) {
        this.deferredPrerequisites.set(type, deferred);
      }
    }

    return spec ?? undefined;
  }

  /** What a field inherited from an interface needs beyond the row its concrete type loads. */
  private inheritedPrerequisites(field: GraphQLField<unknown, unknown>, type: WalkedType) {
    this.typePrerequisite(type);
    const deferred = this.deferredPrerequisites.get(type);
    if (!deferred || !('getInterfaces' in type)) {
      return undefined;
    }
    for (const iface of type.getInterfaces()) {
      const relations = deferred.get(iface.name);
      if (relations && iface.getFields()[field.name]) {
        return relations;
      }
    }
    return undefined;
  }

  fieldSelection(field: GraphQLField<unknown, unknown>, type: WalkedType) {
    let selection = this.fieldSelections.get(field);

    if (selection === undefined) {
      const compiled = compileFieldSelection(field, this.modelFor(type), this) ?? {};
      selection =
        typeof compiled === 'function'
          ? (...args) => {
              const spec = compiled(...args);
              const finish = (value: PrismaNextSpec | false | null | undefined) =>
                value ? withSelectionSource(value, field) : value;
              return isThenable(spec) ? Promise.resolve(spec).then(finish) : finish(spec);
            }
          : withSelectionSource(compiled, field);
      const inherited = this.fallback ? this.inheritedPrerequisites(field, type) : undefined;
      if (inherited) {
        const own = selection;
        const withInherited = (value: PrismaNextSpec): PrismaNextSpec => ({
          ...value,
          relations: { ...inherited, ...value.relations },
        });
        selection =
          typeof own === 'function'
            ? (...args) => {
                const spec = own(...args);
                const finish = (value: PrismaNextSpec | false | null | undefined) =>
                  value ? withInherited(value) : value;
                return isThenable(spec) ? Promise.resolve(spec).then(finish) : finish(spec);
              }
            : withInherited(own);
      }
      this.fieldSelections.set(field, selection);
    }

    return selection ?? undefined;
  }

  createNode(model: PrismaNextModel): PrismaNextNode {
    return createPrismaNextNode(model);
  }

  mergeQuery(node: PrismaNextNode, spec: PrismaNextSpec, options?: MergeOptions) {
    if (this.fallback && options?.lenient) {
      // Parent-row loads keep the field's own query and drop conflicting type-level entries.
      mergeSpec(node, { columns: spec.columns }, spec.alias ?? options.alias);
      for (const [name, entries] of Object.entries(spec.relations ?? {})) {
        for (const entry of Array.isArray(entries) ? entries : [entries]) {
          const part = { ...spec, relations: { [name]: entry } };
          if (this.canMergeQuery(node, part, { alias: options.alias })) {
            mergeSpec(node, part, spec.alias ?? options.alias);
          }
        }
      }
      return;
    }
    if (options?.asQuery) {
      if (spec.refine) {
        node.refine = spec.refine;
      }

      if (spec.slot) {
        node.slot = spec.slot;
      }
    }

    mergeSpec(node, spec, spec.alias ?? options?.alias);
  }

  override canMergeQuery(
    node: PrismaNextNode,
    spec: PrismaNextSpec,
    options?: MergeOptions,
  ): boolean {
    if (!this.fallback) {
      return true;
    }
    // Relations the ORM can't include on this level are left for the loader.
    return (
      !this.conflict(node, spec, options) &&
      !variantRelationProblem(spec, node.model, node.variant, node.variantModel)
    );
  }

  override firstConflict(
    node: PrismaNextNode,
    spec: PrismaNextSpec,
  ): TypeLevelConflict | undefined {
    return this.fallback ? this.conflict(node, spec) : undefined;
  }

  private conflict(
    node: PrismaNextNode,
    spec: PrismaNextSpec,
    options?: MergeOptions,
  ): TypeLevelConflict | undefined {
    const copy = createPrismaNextNode(node.model);
    try {
      this.mergeNode(copy, node);
      this.mergeQuery(copy, spec, options);
      validateIncludes(copy);
      return undefined;
    } catch (error) {
      if (error instanceof SelectionConflict) {
        return { kind: 'relation', name: error.relation };
      }
      throw error;
    }
  }

  toQuery(node: PrismaNextNode): PrismaNextSpec {
    return serializeNode(node);
  }
}

const adapters = new WeakMap<AnyContract, PrismaNextAdapter>();
const fallbackAdapters = new WeakMap<AnyContract, PrismaNextAdapter>();

export function prismaNextAdapter(contract: AnyContract, fallback = false): PrismaNextAdapter {
  const cache = fallback ? fallbackAdapters : adapters;
  let adapter = cache.get(contract);

  if (!adapter) {
    adapter = new PrismaNextAdapter(contract, fallback);
    cache.set(contract, adapter);
  }

  return adapter;
}

function isBranch(entry: PrismaNextRelationEntry): entry is PrismaNextSpec {
  return typeof entry === 'object' && !('fn' in entry);
}

export function emit(
  collection: MapperCollection,
  spec: PrismaNextSpec,
  model: PrismaNextModel | undefined,
  ctx: object,
): MapperCollection {
  let acc = collection;

  if (spec.columns?.length) {
    acc = acc.select(...spec.columns);
  }

  for (const name of Object.keys(spec.relations ?? {})) {
    if (!model) {
      throw new PothosValidationError(`Cannot include relation "${name}" without a model`);
    }

    acc = emitRelation(acc, name, spec.relations![name], model, ctx);
  }

  return acc;
}

/** Consumers sharing a to-one include keep separate child slots, prefixed by their own alias. */
function scopeChildConsumers(branch: PrismaNextSpec): PrismaNextSpec {
  if (!branch.relations) {
    return branch;
  }
  const relations: NonNullable<PrismaNextSpec['relations']> = {};
  for (const [name, entries] of Object.entries(branch.relations)) {
    relations[name] = (Array.isArray(entries) ? entries : [entries]).map((entry) => {
      const child = entry === true ? {} : typeof entry === 'function' ? { fn: entry } : entry;
      return { ...child, alias: selectBranchAlias(branch.alias!, child.alias ?? branch.alias!) };
    });
  }
  return { ...branch, relations };
}

function emitRelation(
  parent: MapperCollection,
  name: string,
  entries: PrismaNextRelationEntry | PrismaNextRelationEntry[],
  model: PrismaNextModel,
  ctx: object,
): MapperCollection {
  const meta = model.relations[name];

  if (!meta) {
    throw new PothosValidationError(`Relation "${name}" does not exist on model ${model.name}`);
  }

  const list = Array.isArray(entries) ? entries : [entries];
  // The ORM reads a single-table variant's rows through the base table without filtering them.
  const variant = meta.targetVariant?.sharesTable ? meta.targetVariant : undefined;
  const include = (refine?: (rel: MapperCollection) => MapperCollection) =>
    variant
      ? parent.include(name, (rel) => {
          const narrowed = rel.where((row: Record<string, { eq(value: unknown): unknown }>) =>
            row[variant.field].eq(variant.value),
          );
          return refine ? refine(narrowed) : narrowed;
        })
      : refine
        ? parent.include(name, refine)
        : parent.include(name);
  const branches = list.filter(isBranch);
  const functions = list.filter(
    (entry): entry is PrismaNextFnEntry | PrismaNextSpecFn => !isBranch(entry) && entry !== true,
  );

  if (!meta.isToMany && functions.length > 0) {
    throw new PothosValidationError(
      `Function-form selection on to-one relation "${name}" requires combine(), which the ORM supports only for to-many relations (ORM.INCLUDE_UNSUPPORTED). ` +
        'Use a relation field with query options or a declarative select instead.',
    );
  }

  if (!meta.isToMany && branches.length > 1 && functions.length === 0) {
    const shared = createPrismaNextNode(meta.target);
    for (const branch of branches) {
      mergeSpec(shared, scopeChildConsumers(branch), branch.alias);
    }
    return include((rel) =>
      emitBranch({ ...serializeNode(shared), refine: branches[0].refine }, rel, meta.target, ctx),
    );
  }

  if (branches.length <= 1 && functions.length === 0) {
    const branch = branches[0];

    return branch ? include((rel) => emitBranch(branch, rel, meta.target, ctx)) : include();
  }

  const merged = functions.length === 0 ? mergeToManyBranches(branches, meta.target) : undefined;

  if (merged) {
    return include((rel) => emitBranch(merged, rel, meta.target, ctx));
  }

  return include((rel) => {
    const combined: Record<string, unknown> = {};

    for (const branch of branches) {
      combined[selectBranchAlias(branch.alias!, branch.slot ?? name)] = emitBranch(
        branch,
        rel,
        meta.target,
        ctx,
      );
    }

    for (const entry of functions) {
      const { fn, alias } = typeof entry === 'function' ? { fn: entry, alias: undefined } : entry;
      const result = fn(rel, ctx);

      if (result && typeof result === 'object') {
        const prefix = fieldAliasPrefix(alias!);

        for (const key of Object.keys(result)) {
          combined[`${prefix}${key}`] = result[key];
        }
      }
    }

    return rel.combine(combined);
  });
}

/** Whether a field alias below `spec` already belongs to another field at the same position. */
function reusesChildAlias(
  spec: PrismaNextSpec,
  path: string,
  owners: Map<string, unknown>,
): boolean {
  for (const [name, entries] of Object.entries(spec.relations ?? {})) {
    for (const entry of Array.isArray(entries) ? entries : [entries]) {
      if (entry === true || typeof entry === 'function') {
        continue;
      }
      const position = `${path}|${entry.alias}`;
      const owner = entry.source ?? ('fn' in entry ? entry.fn : entry.refine) ?? name;
      if (owners.has(position) && owners.get(position) !== owner) {
        return true;
      }
      owners.set(position, owner);
      if (isBranch(entry) && reusesChildAlias(entry, `${position}|${name}`, owners)) {
        return true;
      }
    }
  }
  return false;
}

/** To-many consumers with the same query share an include, unless a child alias is reused. */
function mergeToManyBranches(
  branches: readonly PrismaNextSpec[],
  target: PrismaNextModel,
): PrismaNextSpec | undefined {
  const [first] = branches;
  if (
    !branches.every(
      (branch) =>
        deepEqual(branch.args ?? {}, first.args ?? {}) &&
        sameBranchRefine(first, branch) &&
        branch.variant === first.variant,
    )
  ) {
    return undefined;
  }
  const owners = new Map<string, unknown>();
  if (branches.some((branch) => reusesChildAlias(branch, '', owners))) {
    return undefined;
  }
  const shared = createPrismaNextNode(target);
  try {
    for (const branch of branches) {
      mergeSpec(shared, { columns: branch.columns, relations: branch.relations }, branch.alias);
    }
    validateIncludes(shared);
  } catch (error) {
    if (error instanceof SelectionConflict) {
      return undefined;
    }
    throw error;
  }
  return {
    ...serializeNode(shared),
    refine: first.refine,
    ...(first.variant !== undefined ? { variant: first.variant } : {}),
    ...(first.variantModel !== undefined ? { variantModel: first.variantModel } : {}),
  };
}

export function narrowToVariant(collection: MapperCollection, value: string): MapperCollection {
  if (typeof collection.variant !== 'function') {
    throw new PothosValidationError(
      `Cannot narrow a collection to variant '${value}': it has no variant() method.`,
    );
  }
  return collection.variant(value);
}

function emitBranch(
  branch: PrismaNextSpec,
  rel: MapperCollection,
  target: PrismaNextModel,
  ctx: object,
) {
  // A variant model's own accessor is already narrowed.
  const narrowed =
    branch.variant === undefined || branch.variantModel !== undefined
      ? rel
      : narrowToVariant(rel, branch.variant);
  return emit(
    branch.refine ? (branch.refine(narrowed) ?? narrowed) : narrowed,
    branch,
    target,
    ctx,
  );
}
