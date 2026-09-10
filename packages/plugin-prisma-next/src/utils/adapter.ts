/**
 * How prisma-next's builder-chain query format maps onto `@pothos/selection-mapper`.
 *
 * The walker plans a selection set into a tree of `PrismaNextNode`s (the adapter's own node
 * type: columns, and relations holding alias-keyed branches and function-form entries) through
 * `PrismaNextSpec` maps, and `emit` turns the serialized root into `.select(...)` /
 * `.include(rel, ...)` / `.combine({...})` calls on the resolver's collection.
 *
 * Every relation consumer gets its own combine slot (`<alias>:<slot>`, or
 * `:object:<Type>:<slot>` for a type-level select), so nothing ever conflicts: the adapter
 * extends `Adapter` directly, answers its six members and implements no no-op — the four merge
 * rules are inherited. Rows are read back through the per-resolve overlay in the plugin index,
 * so the loader mappings the plan records are never looked up.
 */
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
import { getModel, type PrismaNextModel, type PrismaNextRelation } from './model.js';

// ---------------------------------------------------------------------------------------------
// The builder surface.
// ---------------------------------------------------------------------------------------------

/**
 * Loose structural shape the emitter chains into. The real orm-client
 * `Collection` is fully typed, but the plugin only knows the model
 * name and columns at runtime — so a fully-typed Collection would
 * collapse `.select(name)` to `keyof never`. Add a method here when
 * orm-client adds one the emitter needs.
 */
export interface MapperCollection {
  select(...fields: string[]): MapperCollection;
  include(name: string, refine?: (rel: MapperCollection) => MapperCollection): MapperCollection;
  combine(spec: Record<string, unknown>): MapperCollection;
  /**
   * In-`include` scalar reducers. `count()` reduces a to-many relation
   * to its row count; `sum`/`avg`/`min`/`max(field)` reduce it to the
   * aggregate of a numeric column (`null` over an empty set). All four
   * return prisma-next `IncludeScalar` brands that flow into a parent
   * `combine({...})` spec, exactly like `count()`.
   */
  count(): unknown;
  sum(field: string): unknown;
  avg(field: string): unknown;
  min(field: string): unknown;
  max(field: string): unknown;
  where(input: unknown): MapperCollection;
  orderBy(input: unknown): MapperCollection;
  /**
   * Native keyset seek. Requires a prior `orderBy(...)` (the real
   * orm-client type-gates this on `hasOrderBy`); seeks strictly past
   * the given column→value boundary in the active orderBy direction
   * (`>` for asc, `<` for desc). Single boundary only.
   */
  cursor(cursorValues: Record<string, unknown>): MapperCollection;
  take(n: number): MapperCollection;
  skip(n: number): MapperCollection;
}

// ---------------------------------------------------------------------------------------------
// Spec: the `Query` the walker passes around.
// ---------------------------------------------------------------------------------------------

export type PrismaNextArgs = Record<string, unknown>;

/** Refines the relation collection before the branch's own selection is emitted onto it. */
export type PrismaNextRefine = (rel: MapperCollection) => MapperCollection | null | undefined;

/**
 * A function-form entry: the combine entries one consumer adds to a relation, each keyed
 * `<alias>:<key>` in the combine spec. Runs at emit time against the relation collection.
 */
export type PrismaNextSpecFn = (sub: MapperCollection, ctx: object) => Record<string, unknown>;

/** A function-form entry with the slot namespace it runs under (the serialized form). */
export interface PrismaNextFnEntry {
  fn: PrismaNextSpecFn;
  alias?: string;
}

/**
 * A selection on one level. On a relation entry it is one branch: its own nested selection,
 * the refine and args applied before the descent, and the slot it answers to (`<alias>:<slot>`,
 * `slot` defaulting to the relation name; a connection uses `rows`).
 */
export interface PrismaNextSpec {
  /**
   * The slot namespace when the walker gives no field key: a type-level select carries
   * `:object:<Type>`; a serialized branch carries the field alias it was walked under, so a
   * spec round-trips through `merge` without a key.
   */
  alias?: string;
  slot?: string;
  /** The field's arguments: two consumers of one slot must agree on them. */
  args?: PrismaNextArgs;
  refine?: PrismaNextRefine;
  columns?: readonly string[];
  relations?: Record<string, PrismaNextRelationEntry | PrismaNextRelationEntry[]>;
}

/**
 * What a relation key holds: `true` (include, nothing beneath), a branch, or a function-form
 * entry. An array lists several consumers of one relation from one field (a connection: its
 * rows branch and its count).
 */
export type PrismaNextRelationEntry = true | PrismaNextSpec | PrismaNextSpecFn | PrismaNextFnEntry;

export type PrismaNextSelectFn = SelectFn<PrismaNextSpec>;
export type PrismaNextPlan = Plan<PrismaNextModel, PrismaNextSpec, PrismaNextNode>;

// ---------------------------------------------------------------------------------------------
// Node: the accumulator.
// ---------------------------------------------------------------------------------------------

export interface PrismaNextBranch {
  alias: string;
  slot: string;
  args: PrismaNextArgs;
  refine?: PrismaNextRefine;
  node: PrismaNextNode;
}

export interface PrismaNextFn {
  alias: string;
  fn: PrismaNextSpecFn;
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
  /** Set by `mergeQuery` on the root of a nested plan; the parent's branch takes them. */
  slot?: string;
  refine?: PrismaNextRefine;
}

export function createPrismaNextNode(model: PrismaNextModel): PrismaNextNode {
  return { model, columns: new Set(), relations: new Map() };
}

// ---------------------------------------------------------------------------------------------
// Slot naming.
// ---------------------------------------------------------------------------------------------

/**
 * Combine-slot key separator. `:` is forbidden by GraphQL's Name
 * grammar (/^[_A-Za-z][_0-9A-Za-z]*$/), so combine keys produced by
 * the walker can NEVER collide with user-provided GraphQL aliases or
 * relation names. Object-level selects prefix with `:object:<typeName>`
 * so variants sharing a row but declaring distinct object-level selects
 * route to distinct combine slots.
 */
const COMBINE_SEPARATOR = ':';
const OBJECT_LEVEL_PREFIX = `${COMBINE_SEPARATOR}object${COMBINE_SEPARATOR}`;

export function objectLevelFieldAlias(typeName: string): string {
  return `${OBJECT_LEVEL_PREFIX}${typeName}`;
}

export function objectLevelBranchAlias(typeName: string, specKey: string): string {
  return `${objectLevelFieldAlias(typeName)}${COMBINE_SEPARATOR}${specKey}`;
}

/** Combine slot key = `<graphqlFieldAlias>:<specKey>`; the per-field overlay reads it back. */
export function selectBranchAlias(fieldAlias: string, specKey: string): string {
  return `${fieldAlias}${COMBINE_SEPARATOR}${specKey}`;
}

/** @internal — also used by the per-field overlay in the plugin index. */
export function fieldAliasPrefix(fieldAlias: string): string {
  return `${fieldAlias}${COMBINE_SEPARATOR}`;
}

// ---------------------------------------------------------------------------------------------
// Merge.
// ---------------------------------------------------------------------------------------------

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

    // W-1: including a relation reads its parent-side FK columns, so prisma-next's
    // nested-stitch works at depth 2+ even when the GraphQL query didn't ask for them.
    for (const column of meta.localFields) {
      node.columns.add(column);
    }
  }

  return relation;
}

/**
 * A slot already present is unioned with the new selection: the walker applies one field once
 * per node that selects it (every `info.fieldNodes` entry; two fragments selecting the same
 * field), and those are the same field with the same arguments by GraphQL's own merge rules.
 * The same slot reached with other arguments (the same alias under `edges.node` and `nodes`
 * with different arguments) cannot share one include, so it is refused.
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

  if (!branch) {
    // To-one relations can't carry multiple branches — the orm returns
    // one row, so sibling aliases would each want their own refined view
    // of the same row.
    if (!relation.meta.isToMany && relation.branches.size > 0) {
      throw new PothosValidationError(
        `Relation "${name}" is to-one — only one branch allowed, got alias "${id}" plus ${[
          ...relation.branches.keys(),
        ]
          .map((key) => `"${key}"`)
          .join(', ')}.`,
      );
    }

    branch = {
      alias,
      slot,
      args,
      refine: spec.refine,
      node: createPrismaNextNode(relation.meta.target),
    };
    relation.branches.set(id, branch);
  } else if (!deepEqual(branch.args, args)) {
    throw new PothosValidationError(
      `Relation "${name}" is selected twice under alias "${id}" with different arguments. Alias one of the selections.`,
    );
  } else {
    branch.refine ??= spec.refine;
  }

  mergeSpec(branch.node, spec, alias);
}

function addFunction(relation: PrismaNextRelationAcc, alias: string, fn: PrismaNextSpecFn) {
  if (!relation.functions.has(alias)) {
    relation.functions.set(alias, { alias, fn });
  }
}

/** M-1, M-2: `spec` into `node`, relation entries slotted under `alias` unless they carry one. */
function mergeSpec(node: PrismaNextNode, spec: PrismaNextSpec, alias: string | undefined) {
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
        addFunction(relation, requireAlias(name, alias), entry);
      } else if ('fn' in entry) {
        addFunction(relation, requireAlias(name, entry.alias ?? alias), entry.fn);
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
        ...(branch.refine ? { refine: branch.refine } : {}),
        ...serializeNode(branch.node),
      });
    }

    for (const fn of relation.functions.values()) {
      entries.push({ alias: fn.alias, fn: fn.fn });
    }

    spec.relations[name] = entries.length === 1 ? entries[0] : entries;
  }

  return spec;
}

// ---------------------------------------------------------------------------------------------
// Compiling the plugin's `select` option shapes into specs.
// ---------------------------------------------------------------------------------------------

/**
 * The public `select` shape on `t.field` / `prismaObject`: a column array, or an object whose
 * keys are columns (`true`) or relations (`true`, a declarative refine, or a function-form
 * entry).
 */
export type RawSelect = readonly string[] | Record<string, unknown>;

/**
 * Declarative refine: `{ where?, orderBy?, take?, skip? }`. Matches
 * the surface of the legacy `query` option. No scalar terminals
 * allowed by construction — anything else must go through function-form.
 */
interface DeclarativeRefineSpec {
  where?: unknown | ((accessor: unknown) => unknown);
  orderBy?: (accessor: unknown) => unknown;
  take?: number;
  skip?: number;
}

function isDeclarativeRefineSpec(value: unknown): value is DeclarativeRefineSpec {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const o = value as Record<string, unknown>;
  // At least one of the declarative keys must be present, and the
  // object can only contain declarative keys (so a function-returning
  // object that happens to have a `where` property isn't misread).
  const hasAny = 'where' in o || 'orderBy' in o || 'take' in o || 'skip' in o;
  if (!hasAny) {
    return false;
  }
  for (const k of Object.keys(o)) {
    if (k !== 'where' && k !== 'orderBy' && k !== 'take' && k !== 'skip') {
      return false;
    }
  }
  return true;
}

/**
 * Compile a declarative refine into a callback the emitter applies to
 * the refinement collection. Where/orderBy callbacks receive the
 * model accessor; static `where` objects pass through to `.where()`
 * directly.
 */
export function compileDeclarativeRefine(spec: DeclarativeRefineSpec): PrismaNextRefine {
  return (rel) => {
    let r = rel;
    if (spec.where !== undefined) {
      r = r.where(spec.where);
    }
    if (spec.orderBy !== undefined) {
      r = r.orderBy(spec.orderBy);
    }
    if (spec.take !== undefined) {
      r = r.take(spec.take);
    }
    if (spec.skip !== undefined) {
      r = r.skip(spec.skip);
    }
    return r;
  };
}

interface CompileOptions {
  /** The model the keys are classified against. */
  model: PrismaNextModel | undefined;
  /** Where the select came from, for error messages. */
  owner: string;
  /** The prefix of the error messages (`select` or `prismaObject select`). */
  label: string;
  /** The slot namespace for entries that need one before the walker assigns a field alias. */
  alias?: string;
  /** The field's arguments, recorded on every branch. */
  args?: PrismaNextArgs;
  /**
   * How a relation entry that includes rows (`true` or a declarative refine) gets its branch:
   * the nested selection beneath the field when it can be walked, an empty branch otherwise.
   */
  branch?: (relation: PrismaNextRelation, query: PrismaNextSpec | undefined) => PrismaNextSpec;
  /** How a function-form entry is bound to the field's args and context. */
  fn?: (value: (...args: unknown[]) => unknown) => PrismaNextSpecFn;
}

/** Turns one `select` value into a spec. Throws on a key that is neither column nor relation. */
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
        ? options.fn(value as (...args: unknown[]) => unknown)
        : (value as PrismaNextSpecFn);
      hasRelations = true;
    } else if (isDeclarativeRefineSpec(value)) {
      if (!relation) {
        throw new PothosValidationError(
          `${label}: '${key}' has a { where, take, skip, orderBy } entry but is not a relation on ${owner}.`,
        );
      }

      const refine = compileDeclarativeRefine(value);

      relations[key] = {
        ...(options.branch ? options.branch(relation, { refine }) : { refine }),
        args: options.args ?? {},
      };
      hasRelations = true;
    } else {
      // Anything that isn't true/false/declarative/function is a
      // malformed spec. Most common cause: a typo in declarative-keys
      // like `{ posts: { whre: ... } }`, which silently dropped before
      // this guard.
      throw new PothosValidationError(
        `${label}: '${key}' has an unrecognized value shape. Use \`true\`, ` +
          '`{ where?, orderBy?, take?, skip? }`, or a function ' +
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

/** A select object whose entries are all columns: compiled once, no select function needed. */
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

/**
 * S-4..S-6 for one field of `parentModel`: the columns of `t.expose*` (`pothosExposedField`),
 * the `select` option (`pothosOptions.select`: columns, or relations that need a select function
 * so the nested selection beneath the field can be walked), and `t.variant` (a field-level
 * indirect include without a path: the variant type's selection set is walked on the same row).
 */
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
  // The model the field returns directly. Undefined for a scalar (a nested selection there is
  // the query alone) and for a wrapper such as an errors-plugin result type (the walker follows
  // its include; the adapter cannot without the schema, so it descends).
  const returnModel = modelFor(getNamedType(field.type));
  const indirect = ext.pothosIndirectInclude;
  const owner = parentModel?.name ?? '(unknown model)';

  const withColumns = (spec: PrismaNextSpec, extra: readonly string[]): PrismaNextSpec =>
    extra.length === 0 ? spec : { ...spec, columns: [...extra, ...(spec.columns ?? [])] };

  // t.variant: the same-row redirect into the named type's selection set, with the forced
  // column reads of its `select` option applied to the same level.
  if (indirect && !indirect.path?.length && !indirect.paths?.length) {
    const forced = Array.isArray(raw) ? (raw as readonly string[]) : [];

    return (_args, _ctx, nested) => withColumns(nested(true), [...exposed, ...forced]);
  }

  if (raw === undefined) {
    return exposed.length > 0 ? { columns: exposed } : undefined;
  }

  const compile = (
    value: RawSelect,
    args: PrismaNextArgs,
    nested: NestedSelection<PrismaNextSpec>,
  ): PrismaNextSpec =>
    withColumns(
      compileSelect(value, {
        model: parentModel,
        owner,
        label: 'select',
        args,
        // The nested selection is walked as the field's return type, so when that type is
        // known to be backed by another model than the relation's, the entry is a bare include.
        branch: (relation, query) =>
          returnModel && returnModel !== relation.target ? (query ?? {}) : nested(query),
        fn: (value) => (sub, fnCtx) =>
          (value as PrismaNextSpecFn & ((s: unknown, a: unknown, c: unknown) => never))(
            sub,
            args,
            fnCtx,
          ) as Record<string, unknown>,
      }),
      exposed,
    );

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

/**
 * S-1: the type's `PRISMA_NEXT_SELECT`, `string[]` or an object of columns and relation
 * entries, compiled once to a spec slotted under `:object:<Type>`.
 */
function compileTypeSelection(
  type: GraphQLNamedType,
  model: PrismaNextModel | undefined,
): PrismaNextSpec | undefined {
  const raw = type.extensions?.[PRISMA_NEXT_SELECT] as RawSelect | undefined;

  if (!raw) {
    return undefined;
  }

  return compileSelect(raw, {
    model,
    owner: type.name,
    label: 'prismaObject select',
    alias: objectLevelFieldAlias(type.name),
    // A type-level function entry runs with no field arguments.
    fn: (value) => (sub, ctx) => value(sub, {}, ctx) as Record<string, unknown>,
  });
}

// ---------------------------------------------------------------------------------------------
// The adapter, one per contract.
// ---------------------------------------------------------------------------------------------

/**
 * Every relation consumer gets its own combine slot, so there is nothing to compare and nothing
 * to leave out: `accepts`, `conflict`, `absorb` and `acceptsFrom` are inherited, and the package
 * answers "nothing ever conflicts" for them. The contract the models come from, and the compiled
 * selections cached against the schema's types and fields, are this object's own state.
 */
export class PrismaNextAdapter extends Adapter<PrismaNextModel, PrismaNextSpec, PrismaNextNode> {
  private readonly typeSelections = new WeakMap<GraphQLNamedType, PrismaNextSpec | null>();
  private readonly fieldSelections = new WeakMap<
    GraphQLField<unknown, unknown>,
    PrismaNextSpec | PrismaNextSelectFn | null
  >();

  constructor(private readonly contract: AnyContract) {
    super();
  }

  modelFor(type: GraphQLNamedType): PrismaNextModel | undefined {
    const name = type.extensions?.[PRISMA_NEXT_MODEL] as string | undefined;

    return name === undefined ? undefined : getModel(this.contract, name);
  }

  typeSelection(type: GraphQLNamedType): PrismaNextSpec | undefined {
    let spec = this.typeSelections.get(type);

    if (spec === undefined) {
      spec = compileTypeSelection(type, this.modelFor(type)) ?? null;
      this.typeSelections.set(type, spec);
    }

    return spec ?? undefined;
  }

  // A `GraphQLField` belongs to one type (`type.getFields()`), so the compile is cached on it.
  fieldSelection(field: GraphQLField<unknown, unknown>, type: WalkedType) {
    let selection = this.fieldSelections.get(field);

    if (selection === undefined) {
      selection = compileFieldSelection(field, this.modelFor(type), this) ?? null;
      this.fieldSelections.set(field, selection);
    }

    return selection ?? undefined;
  }

  create(model: PrismaNextModel): PrismaNextNode {
    return createPrismaNextNode(model);
  }

  /**
   * The slot namespace is the spec's own (`:object:<Type>`, or a serialized spec's field alias)
   * or the response key of the field the traversal is merging. E-3: a relation query is the
   * branch's refine and slot; its columns (a connection's cursor) are read on the relation.
   */
  merge(node: PrismaNextNode, spec: PrismaNextSpec, options?: MergeOptions) {
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

  emit(node: PrismaNextNode): PrismaNextSpec {
    return serializeNode(node);
  }
}

const adapters = new WeakMap<AnyContract, PrismaNextAdapter>();

export function prismaNextAdapter(contract: AnyContract): PrismaNextAdapter {
  let adapter = adapters.get(contract);

  if (!adapter) {
    adapter = new PrismaNextAdapter(contract);
    adapters.set(contract, adapter);
  }

  return adapter;
}

// ---------------------------------------------------------------------------------------------
// Emission: a serialized spec as builder calls.
// ---------------------------------------------------------------------------------------------

function isBranch(entry: PrismaNextRelationEntry): entry is PrismaNextSpec {
  return typeof entry === 'object' && !('fn' in entry);
}

/** Emits a serialized spec (every relation entry carries its alias) as a chain on `collection`. */
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

// Single-consumer fast path: `.include(rel, cb => …)` direct — to-one
// relations and to-many with exactly one branch and no function-form
// entry. Multi-consumer or any function-form entry goes through
// `.combine({...})` for collision-free aliasing — prisma-next's
// planner falls back to multi-query for any include with combine
// (painpoint #3), so we keep the single-consumer path for perf.
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
  const branches = list.filter(isBranch);
  const functions = list.filter(
    (entry): entry is PrismaNextFnEntry | PrismaNextSpecFn => !isBranch(entry) && entry !== true,
  );

  if (!(meta.isToMany && (branches.length > 1 || functions.length > 0))) {
    const branch = branches[0];

    // No branches at all (only a function-form entry on a to-one relation): a no-refine include
    // so the relation still preloads.
    return branch
      ? parent.include(name, (rel) => emitBranch(branch, rel, meta.target, ctx))
      : parent.include(name);
  }

  return parent.include(name, (rel) => {
    // Combine spec keys are namespaced with `:` (GraphQL-forbidden), so
    // collisions with reserved JS object keys can't be forged from user
    // input. A plain object is safe.
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

function emitBranch(
  branch: PrismaNextSpec,
  rel: MapperCollection,
  target: PrismaNextModel,
  ctx: object,
) {
  // `refine` (compiled from the user's declarative refine or `query`
  // option) runs before the inner descent so the filter applies to
  // the row set the inner selection columns are read against.
  return emit(branch.refine ? (branch.refine(rel) ?? rel) : rel, branch, target, ctx);
}
