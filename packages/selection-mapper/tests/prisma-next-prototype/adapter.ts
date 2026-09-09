/**
 * A prototype adapter driving `@pothos/selection-mapper` for prisma-next's builder-chain query
 * format, modelled on `packages/plugin-prisma-next/src/utils/apply-selection.ts` (branch
 * `origin/mh--plugin-prisma-next`). Nothing here touches the real orm-client: `MapperCollection`
 * is the loose surface apply-selection.ts declares (~74-104), and `RecordingCollection` records
 * the chain so emission can be asserted.
 *
 * Shapes:
 *   - `PnModel`: what a type carries (columns, relations with cardinality, FK columns, target).
 *   - `PnNode`: the accumulator, apply-selection's `LevelAcc` (~163-166) with `RelationAcc`
 *     (~148-155) beneath: alias-keyed branches, spec functions, parent-side FK columns. The one
 *     difference: a branch holds the already-walked child node instead of a `descend` closure
 *     (~123-134), because the walker walks nested selections eagerly through `nested()`.
 *   - `PnSpec`: the data format a field or type hands the adapter, and what `serialize` returns.
 *     A plain object (`initial` / `noMatch` may be `{}`) carrying columns, alias-keyed relation
 *     branches with a refine and args, function-form entries (count reducers), and the slot
 *     namespace (`:object:<Type>` for a type-level select).
 *   - `emit`: turns a serialized spec into builder calls (apply-selection's `emitLevel` /
 *     `emitRelation` / `emitBranch`, ~915-1001).
 */
import type { GraphQLNamedType } from 'graphql';
import type { Adapter, SelectFn, Walk } from '../../src';

// ---------------------------------------------------------------------------------------------
// The builder surface (apply-selection.ts ~74-104).
// ---------------------------------------------------------------------------------------------

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
  cursor(cursorValues: Record<string, unknown>): MapperCollection;
  take(n: number): MapperCollection;
  skip(n: number): MapperCollection;
}

// ---------------------------------------------------------------------------------------------
// Model.
// ---------------------------------------------------------------------------------------------

/** `PRISMA_NEXT_RELATIONS` metadata (index.ts ~101-119) with the target resolved to a model. */
export interface PnRelationMeta {
  isToMany: boolean;
  /** Parent-side FK columns added to the parent's select when the relation is included (W-1). */
  localFields: readonly string[];
  target: PnModel;
}

/** One object per model, so model identity is model equality. */
export interface PnModel {
  name: string;
  relations: Record<string, PnRelationMeta>;
}

// ---------------------------------------------------------------------------------------------
// Spec: the `Map` the walker passes around.
// ---------------------------------------------------------------------------------------------

export type PnArgs = Record<string, unknown>;

/** apply-selection's `RefineFn` (~113): refines the relation collection before the descent. */
export type PnRefine = (
  rel: MapperCollection,
  args: PnArgs,
  ctx: object,
) => MapperCollection | null | undefined;

/**
 * apply-selection's `RelationSpecFn.fn` (~142-146): the combine entries a consumer adds to the
 * relation, each keyed `<alias>:<key>` in the combine spec.
 */
export type PnSpecFn = (
  sub: MapperCollection,
  args: PnArgs,
  ctx: object,
) => Record<string, unknown>;

/** A function-form entry with the slot namespace and args it runs with (the serialized form). */
export interface PnFnEntry {
  fn: PnSpecFn;
  alias?: string;
  args?: PnArgs;
}

/**
 * A selection on one level. On a relation entry it is one branch: its own nested selection,
 * the refine and args applied before the descent, and the slot it answers to (`<alias>:<slot>`,
 * `slot` defaulting to the relation name; a connection uses `rows`).
 */
export interface PnSpec {
  /**
   * The slot namespace when the walker gives no field key: a type-level select carries
   * `:object:<Type>` (apply-selection ~779-788); a serialized branch carries the field alias it
   * was walked under, so a spec round-trips through `merge` without a key.
   */
  alias?: string;
  slot?: string;
  args?: PnArgs;
  refine?: PnRefine;
  columns?: readonly string[];
  relations?: Record<string, PnRelationEntry | PnRelationEntry[]>;
}

/**
 * What a relation key holds: `true` (include, nothing beneath), a branch, or a function-form
 * entry. An array lists several consumers of one relation from one field (a connection: its
 * rows branch and its count).
 */
export type PnRelationEntry = true | PnSpec | PnSpecFn | PnFnEntry;

/** `Adapter.X`: nothing is threaded to select functions. */
export type PnExtra = undefined;

// ---------------------------------------------------------------------------------------------
// Node: the accumulator.
// ---------------------------------------------------------------------------------------------

export interface PnBranch {
  alias: string;
  slot: string;
  args: PnArgs;
  refine?: PnRefine;
  node: PnNode;
}

export interface PnFn {
  alias: string;
  args: PnArgs;
  fn: PnSpecFn;
}

export interface PnRelation {
  meta: PnRelationMeta;
  /** Keyed `<alias>:<slot>`. */
  branches: Map<string, PnBranch>;
  /** Keyed by alias: one field adds one function to a relation. */
  functions: Map<string, PnFn>;
}

export interface PnNode {
  model: PnModel;
  columns: Set<string>;
  relations: Map<string, PnRelation>;
  /** Set by `mergeQuery` on the root of a nested walk; the parent's branch takes them. */
  refine?: PnRefine;
  args?: PnArgs;
}

export type PnSelectFn = SelectFn<PnSpec, PnExtra>;
export type PnAdapter = Adapter<PnModel, PnSpec, PnExtra, PnNode>;
export type PnWalk = Walk<PnModel, PnSpec, PnExtra, PnNode>;

/** The extension keys the adapter reads; the test schema sets them. */
export const PN_MODEL = 'pnModel';
export const PN_SELECT = 'pnSelect';

export function createPnNode(model: PnModel): PnNode {
  return { model, columns: new Set(), relations: new Map() };
}

const COMBINE_SEPARATOR = ':';

/** apply-selection ~782-784. */
export function objectLevelAlias(typeName: string): string {
  return `${COMBINE_SEPARATOR}object${COMBINE_SEPARATOR}${typeName}`;
}

function getOrCreateRelation(node: PnNode, name: string): PnRelation {
  let relation = node.relations.get(name);

  if (!relation) {
    const meta = node.model.relations[name];

    if (!meta) {
      throw new Error(`Relation "${name}" does not exist on ${node.model.name}`);
    }

    relation = { meta, branches: new Map(), functions: new Map() };
    node.relations.set(name, relation);

    // W-1 (apply-selection ~371-378, ~629-631): including a relation reads its FK columns.
    for (const column of meta.localFields) {
      node.columns.add(column);
    }
  }

  return relation;
}

/**
 * apply-selection's `addBranch` (~1044-1068), except that a slot already present is unioned
 * with the new selection instead of rejected: the walker applies one field once per node that
 * selects it (W-1: every `info.fieldNodes` entry; two fragments selecting the same field), and
 * those are the same field with the same arguments by GraphQL's own merge rules.
 */
function addBranch(relation: PnRelation, name: string, alias: string, spec: PnSpec) {
  const slot = spec.slot ?? name;
  const id = `${alias}${COMBINE_SEPARATOR}${slot}`;
  let branch = relation.branches.get(id);

  if (!branch) {
    if (!relation.meta.isToMany && relation.branches.size > 0) {
      throw new Error(
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
      args: spec.args ?? {},
      refine: spec.refine,
      node: createPnNode(relation.meta.target),
    };
    relation.branches.set(id, branch);
  } else {
    branch.refine ??= spec.refine;
  }

  mergeSpec(branch.node, spec, alias);
}

function addFunction(relation: PnRelation, alias: string, args: PnArgs, fn: PnSpecFn) {
  if (!relation.functions.has(alias)) {
    relation.functions.set(alias, { alias, args, fn });
  }
}

/** M-1, M-2: `spec` into `node`, relation entries slotted under `alias` unless they carry one. */
function mergeSpec(node: PnNode, spec: PnSpec, alias: string | undefined) {
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
      if (entry === true) {
        addBranch(relation, name, requireAlias(name, alias), {});
      } else if (typeof entry === 'function') {
        addFunction(relation, requireAlias(name, alias), {}, entry);
      } else if ('fn' in entry) {
        addFunction(relation, requireAlias(name, entry.alias ?? alias), entry.args ?? {}, entry.fn);
      } else {
        addBranch(relation, name, requireAlias(name, entry.alias ?? alias), entry);
      }
    }
  }
}

function requireAlias(name: string, alias: string | undefined): string {
  if (alias === undefined) {
    throw new Error(
      `Relation "${name}" was merged without a slot: the walker gave no field key and the entry carries no alias.`,
    );
  }

  return alias;
}

function serializeNode(node: PnNode): PnSpec {
  const spec: PnSpec = {};

  if (node.refine) {
    spec.refine = node.refine;
  }

  if (node.args) {
    spec.args = node.args;
  }

  if (node.columns.size > 0) {
    spec.columns = [...node.columns];
  }

  if (node.relations.size === 0) {
    return spec;
  }

  spec.relations = {};

  for (const [name, relation] of node.relations) {
    const entries: PnRelationEntry[] = [];

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
      entries.push({ alias: fn.alias, args: fn.args, fn: fn.fn });
    }

    spec.relations[name] = entries.length === 1 ? entries[0] : entries;
  }

  return spec;
}

const typeSelections = new WeakMap<GraphQLNamedType, PnSpec | null>();

/**
 * S-1: the type's `PRISMA_NEXT_SELECT`, `string[]` or an object of columns and relation entries
 * (apply-selection ~795-878), compiled once to a spec slotted under `:object:<Type>`.
 */
function typeSelectionOf(type: GraphQLNamedType): PnSpec | undefined {
  let spec = typeSelections.get(type);

  if (spec === undefined) {
    const raw = type.extensions?.[PN_SELECT] as readonly string[] | PnSpec | undefined;

    spec = !raw
      ? null
      : Array.isArray(raw)
        ? { columns: raw }
        : { ...(raw as PnSpec), alias: objectLevelAlias(type.name) };
    typeSelections.set(type, spec);
  }

  return spec ?? undefined;
}

export const pnAdapter: PnAdapter = {
  skipDeferredFragments: true,
  modelFor: (type) => type.extensions?.[PN_MODEL] as PnModel | undefined,
  createNode: createPnNode,
  typeSelection: typeSelectionOf,
  // S-4..S-6: a static spec or a select function, precompiled onto the field by the schema.
  fieldSelection: (field) => field.extensions?.[PN_SELECT] as PnSpec | PnSelectFn | undefined,
  // Rows are read back through the per-resolve overlay, never through loader mappings.
  recordsMappings: false,
  // The slot namespace is the spec's own (`:object:<Type>`, or a serialized spec's field alias)
  // or the response key of the field the walker is merging.
  merge(node, spec, _key, alias) {
    mergeSpec(node, spec, spec.alias ?? alias);
  },
  // M-3: every consumer gets its own slot, so nothing ever conflicts.
  compatible: () => true,
  // E-3: the relation query is the branch's refine; its columns (a connection's cursor) are
  // read on the relation.
  mergeQuery(node, query) {
    if (!query) {
      return;
    }

    if (query.refine) {
      node.refine = query.refine;
    }

    if (query.args) {
      node.args = query.args;
    }

    mergeSpec(node, query, query.alias);
  },
  // S-7: type-level selects never conflict either.
  typeLevelConflict: () => undefined,
  // E-2: nothing to leave out.
  withoutConflicts: (_node, spec) => spec,
  serialize: serializeNode,
};

// ---------------------------------------------------------------------------------------------
// Emission (apply-selection ~915-1019).
// ---------------------------------------------------------------------------------------------

function isBranch(entry: PnRelationEntry): entry is PnSpec {
  return typeof entry === 'object' && !('fn' in entry);
}

/** Emits a serialized spec (every entry carries its alias) as a chain on `collection`. */
export function emit(
  collection: MapperCollection,
  spec: PnSpec,
  model: PnModel,
  ctx: object,
): MapperCollection {
  let acc = collection;

  if (spec.columns?.length) {
    acc = acc.select(...spec.columns);
  }

  for (const name of Object.keys(spec.relations ?? {})) {
    acc = emitRelation(acc, name, spec.relations![name], model, ctx);
  }

  return acc;
}

function emitRelation(
  parent: MapperCollection,
  name: string,
  entries: PnRelationEntry | PnRelationEntry[],
  model: PnModel,
  ctx: object,
): MapperCollection {
  const meta = model.relations[name];

  if (!meta) {
    throw new Error(`Relation "${name}" does not exist on ${model.name}`);
  }

  const list = Array.isArray(entries) ? entries : [entries];
  const branches = list.filter(isBranch);
  const functions = list.filter((entry): entry is PnFnEntry => !isBranch(entry) && entry !== true);

  // Single-consumer fast path (apply-selection ~931-958): a to-one relation, or a to-many with
  // one branch and no function-form entry, is a plain include.
  if (!(meta.isToMany && (branches.length > 1 || functions.length > 0))) {
    const branch = branches[0];

    return branch
      ? parent.include(name, (rel) => emitBranch(branch, rel, meta.target, ctx))
      : parent.include(name);
  }

  return parent.include(name, (rel) => {
    const combined: Record<string, unknown> = {};

    for (const branch of branches) {
      combined[`${branch.alias}${COMBINE_SEPARATOR}${branch.slot}`] = emitBranch(
        branch,
        rel,
        meta.target,
        ctx,
      );
    }

    for (const entry of functions) {
      const result = entry.fn(rel, entry.args ?? {}, ctx);

      for (const key of Object.keys(result)) {
        combined[`${entry.alias}${COMBINE_SEPARATOR}${key}`] = result[key];
      }
    }

    return rel.combine(combined);
  });
}

function emitBranch(branch: PnSpec, rel: MapperCollection, target: PnModel, ctx: object) {
  return emit(
    branch.refine ? (branch.refine(rel, branch.args ?? {}, ctx) ?? rel) : rel,
    branch,
    target,
    ctx,
  );
}

// ---------------------------------------------------------------------------------------------
// A recording collection: immutable like the real builder, so two branches of one combine are
// two distinct chains.
// ---------------------------------------------------------------------------------------------

export interface RecordedCall {
  method: string;
  args?: unknown[];
  inner?: RecordedCall[];
  slots?: Record<string, unknown>;
}

/** What a reducer such as `count()` returns: the chain it reduces. */
export interface Reducer {
  reduce: string;
  calls: RecordedCall[];
}

export class RecordingCollection implements MapperCollection {
  constructor(readonly calls: RecordedCall[] = []) {}

  private chain(method: string, ...args: unknown[]) {
    return new RecordingCollection([...this.calls, { method, args }]);
  }

  private reduce(reduce: string): Reducer {
    return { reduce, calls: this.calls };
  }

  select(...fields: string[]) {
    return this.chain('select', ...fields);
  }

  include(name: string, refine?: (rel: MapperCollection) => MapperCollection) {
    const inner = refine ? (refine(new RecordingCollection()) as RecordingCollection).calls : [];

    return new RecordingCollection([...this.calls, { method: 'include', args: [name], inner }]);
  }

  combine(spec: Record<string, unknown>) {
    const slots: Record<string, unknown> = {};

    for (const key of Object.keys(spec)) {
      const value = spec[key];

      slots[key] = value instanceof RecordingCollection ? value.calls : value;
    }

    return new RecordingCollection([...this.calls, { method: 'combine', slots }]);
  }

  count() {
    return this.reduce('count');
  }

  sum(field: string) {
    return this.reduce(`sum(${field})`);
  }

  avg(field: string) {
    return this.reduce(`avg(${field})`);
  }

  min(field: string) {
    return this.reduce(`min(${field})`);
  }

  max(field: string) {
    return this.reduce(`max(${field})`);
  }

  where(input: unknown) {
    return this.chain('where', input);
  }

  orderBy(input: unknown) {
    return this.chain('orderBy', input);
  }

  cursor(values: Record<string, unknown>) {
    return this.chain('cursor', values);
  }

  take(n: number) {
    return this.chain('take', n);
  }

  skip(n: number) {
    return this.chain('skip', n);
  }
}

/** Renders each top-level call of a chain on one line, nested chains inline. */
export function render(collection: MapperCollection): string[] {
  return (collection as RecordingCollection).calls.map(renderCall);
}

function renderCalls(calls: RecordedCall[]): string {
  return calls.map(renderCall).join(' ');
}

function renderCall(call: RecordedCall): string {
  switch (call.method) {
    case 'select':
      return `select(${(call.args as string[]).join(', ')})`;
    case 'include':
      return call.inner!.length > 0
        ? `include(${call.args![0]}){ ${renderCalls(call.inner!)} }`
        : `include(${call.args![0]})`;
    case 'combine':
      return `combine(${Object.keys(call.slots!)
        .map((key) => `${key}=${renderSlot(call.slots![key])}`)
        .join(', ')})`;
    default:
      return `${call.method}(${call.args!.map(show).join(', ')})`;
  }
}

function renderSlot(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${renderCalls(value as RecordedCall[])}]`;
  }

  if (value && typeof value === 'object' && 'reduce' in value) {
    const { reduce, calls } = value as Reducer;

    return `${reduce}[${renderCalls(calls)}]`;
  }

  return show(value);
}

function show(value: unknown): string {
  return typeof value === 'function' ? 'fn' : JSON.stringify(value);
}
