/**
 * Walks GraphQL info and emits the orm-client chain inline onto a
 * `MapperCollection`. There is no intermediate tree — the walker
 * descends into includes via the include's callback so each level's
 * state lives only as locals during one stack frame.
 *
 * Each field with prisma-next-relevant behavior carries:
 *   - `pothosOptions.select` — column reads + relation includes (the
 *     main user-facing surface; sugar `t.relation` / `t.relatedConnection`
 *     and direct `t.field({ select })` all compile to this)
 *   - `pothosIndirectInclude` (field- or type-level) — descent into a
 *     named type or through a `paths` list. Used by `t.variant` (same
 *     row, descend into variant type's selection set), by
 *     `t.relatedConnection` (paths into `edges.node` / `nodes`), and
 *     by plugin-errors (paths into a result-union wrapper).
 *
 * The walker honors `pothosIndirectInclude` on a type (set by e.g.
 * plugin-errors on result-union types) AND on a field (set by us for
 * variant and connection). Both descend through the same machinery so a
 * result-union *of* a connection works without special-casing.
 */
import { getMappedArgumentValues, PothosValidationError } from '@pothos/core';
import {
  type FieldNode,
  type FragmentDefinitionNode,
  type FragmentSpreadNode,
  GraphQLIncludeDirective,
  type GraphQLInterfaceType,
  type GraphQLNamedType,
  type GraphQLObjectType,
  type GraphQLResolveInfo,
  GraphQLSkipDirective,
  getDirectiveValues,
  getNamedType,
  type InlineFragmentNode,
  isInterfaceType,
  isObjectType,
  Kind,
  type SelectionSetNode,
} from 'graphql';
import {
  PRISMA_NEXT_COLUMNS,
  PRISMA_NEXT_MODEL,
  PRISMA_NEXT_RELATIONS,
  PRISMA_NEXT_SELECT,
} from '../constants';
import type { AnyContract } from '../types';

// ---------------------------------------------------------------------
// Public types. `PothosPrismaNextConfig` is consumed by the walker
// (skipDeferred + connection-size defaults); `IndirectInclude` is set
// on field/type extensions by other plugins (e.g. plugin-errors) and
// by the plugin's own sugar (t.variant, t.relatedConnection).
// ---------------------------------------------------------------------

export interface PothosPrismaNextConfig {
  contract: AnyContract;
  skipDeferredFragments: boolean;
}

export interface IndirectInclude {
  getType: () => string;
  path?: { type?: string; name: string }[];
  paths?: { type?: string; name: string }[][];
}

/**
 * Loose structural shape the walker chains into. The real orm-client
 * `Collection` is fully typed, but the plugin only knows the model
 * name and columns at runtime — so a fully-typed Collection would
 * collapse `.select(name)` to `keyof never`. Add a method here when
 * orm-client adds one the walker needs.
 */
export interface MapperCollection {
  select(...fields: string[]): MapperCollection;
  include(name: string, refine?: (rel: MapperCollection) => MapperCollection): MapperCollection;
  combine(spec: Record<string, unknown>): MapperCollection;
  count(): unknown;
  where(input: unknown): MapperCollection;
  orderBy(input: unknown): MapperCollection;
  take(n: number): MapperCollection;
  skip(n: number): MapperCollection;
}

// ---------------------------------------------------------------------
// Per-level transient accumulators. These live only inside one walk
// frame; nothing leaves the function. Branches hold enough info
// (target type + selection node + deferred flag) for the .include
// callback to recurse into the inner level.
// ---------------------------------------------------------------------

type RefineFn = (rel: unknown, args: unknown, ctx: unknown) => unknown;
type CountWhere = unknown | ((accessor: unknown, args: unknown, ctx: unknown) => unknown);

/**
 * A branch on a relation that contributes an include shape: optional
 * refine, then a recursive descent into the inner type's selections
 * via `descend(rel)`. Cursor pagination is no longer a walker concern
 * — `t.relatedConnection` now compiles to a function-form `select`
 * spec that applies pagination inside the user-supplied callback.
 */
interface BranchAcc {
  args: Record<string, unknown>;
  refine?: RefineFn;
  /**
   * Walk the inner selection of this branch onto the given
   * relation-scope collection, returning the augmented collection.
   * Closes over the parent walker's info/config/context so the inner
   * type + selection node + deferred flag are bound at branch-creation
   * time.
   */
  descend: (rel: MapperCollection) => MapperCollection;
}

interface CountAcc {
  args: Record<string, unknown>;
  where?: CountWhere;
  refine?: RefineFn;
}

interface RelationSpecFn {
  fieldAlias: string;
  args: Record<string, unknown>;
  fn: (sub: unknown, args: Record<string, unknown>, ctx: unknown) => Record<string, unknown>;
}

interface RelationAcc {
  isToMany: boolean;
  branches: Map<string, BranchAcc>;
  counts: Map<string, CountAcc>;
  specFunctions: RelationSpecFn[];
  /** Parent-side FK columns to add to the parent's SELECT (W-1). */
  parentFkColumns: readonly string[];
}

/**
 * Walker state assembled at a single level. Columns and relations
 * accumulate as the walker visits the type's selection set; when the
 * walk completes the caller emits `.select(...columns)` and then
 * `.include(rel, …)` per relation.
 */
interface LevelAcc {
  columns: Set<string>;
  relations: Map<string, RelationAcc>;
}

function newLevel(): LevelAcc {
  return { columns: new Set(), relations: new Map() };
}

function getOrCreateRelation(level: LevelAcc, name: string, isToMany: boolean): RelationAcc {
  let rel = level.relations.get(name);
  if (!rel) {
    rel = {
      isToMany,
      branches: new Map(),
      counts: new Map(),
      specFunctions: [],
      parentFkColumns: [],
    };
    level.relations.set(name, rel);
  }
  return rel;
}

// ---------------------------------------------------------------------
// Entry point — public API. Walks `info` and emits the chain on
// `baseCollection`, returning the augmented collection.
// ---------------------------------------------------------------------

/**
 * Walks the GraphQL info, accumulates per-level column/relation state
 * internally, and emits the orm-client chain on `baseCollection`.
 * Returns the augmented collection — the intermediate state lives only
 * for the duration of one call.
 */
export function applySelectionToCollection(
  baseCollection: MapperCollection,
  info: GraphQLResolveInfo,
  contract: AnyContract,
  context: unknown,
  options: {
    paths?: string[][];
    path?: string[];
    extraColumns?: readonly string[];
    skipDeferredFragments?: boolean;
    typeName?: string;
    /**
     * Override the starting selection node. Defaults to
     * `info.fieldNodes[0]` (the field whose resolver received `info`).
     * Set explicitly when the caller is descending from a NESTED field
     * selection — e.g. a relatedConnection's select callback that runs
     * during the parent's walk and needs to descend from the
     * connection field's selection rather than the root resolver's
     * selection.
     */
    fieldNode?: FieldNode;
    /**
     * Override the starting type — must match the type that
     * `fieldNode` returns. Defaults to `getNamedType(info.returnType)`.
     */
    startType?: GraphQLNamedType;
  } = {},
): MapperCollection {
  // Plain assignment over conditional spreads — same observable
  // behavior (undefined leaves the consumer's default) but keeps the
  // hidden class stable across resolves.
  const config: PothosPrismaNextConfig = {
    contract,
    skipDeferredFragments: options.skipDeferredFragments ?? true,
  };
  const ctx = (context as object) ?? {};

  const returnType = options.startType ?? getNamedType(info.returnType);
  const rootType = options.typeName ? info.schema.getTypeMap()[options.typeName]! : returnType;
  const startFieldNode = options.fieldNode ?? info.fieldNodes[0]!;

  const level = newLevel();
  if (options.extraColumns) {
    for (const col of options.extraColumns) {
      level.columns.add(col);
    }
  }

  if (options.path?.length || options.paths?.length) {
    const { pothosIndirectInclude } = (returnType.extensions ?? {}) as {
      pothosIndirectInclude?: IndirectInclude;
    };
    resolveIndirectInclude(
      returnType,
      info,
      startFieldNode,
      pothosIndirectInclude?.path ?? [],
      [],
      (indirectType, indirectField, _subPath, deferred) => {
        resolveIndirectIncludePaths(
          indirectType,
          info,
          indirectField,
          [],
          options.paths?.length
            ? options.paths.map((p) => p.map((n) => (typeof n === 'string' ? { name: n } : n)))
            : [options.path!.map((n) => (typeof n === 'string' ? { name: n } : n))],
          [],
          (resolvedType, resolvedField, _p, resolvedDeferred) => {
            walkField(
              options.typeName ? rootType : resolvedType,
              resolvedField,
              info,
              config,
              ctx,
              resolvedDeferred,
              level,
            );
          },
          deferred,
        );
      },
    );
  } else {
    walkField(rootType, startFieldNode, info, config, ctx, false, level);
  }

  return emitLevel(level, baseCollection, ctx, config);
}

// ---------------------------------------------------------------------
// Walker — populates `level` from a field's selection set.
// ---------------------------------------------------------------------

function walkField(
  type: GraphQLNamedType,
  selection: FieldNode,
  info: GraphQLResolveInfo,
  config: PothosPrismaNextConfig,
  context: object,
  deferred: boolean,
  level: LevelAcc,
): void {
  if (selection.name.value.startsWith('__')) {
    return;
  }

  const { pothosIndirectInclude } = (type.extensions ?? {}) as {
    pothosIndirectInclude?: IndirectInclude;
  };

  if (
    (!!pothosIndirectInclude?.path && pothosIndirectInclude.path.length > 0) ||
    (!!pothosIndirectInclude?.paths && pothosIndirectInclude.paths.length > 0)
  ) {
    resolveIndirectIncludePaths(
      type,
      info,
      selection,
      [],
      pothosIndirectInclude.paths ?? [pothosIndirectInclude.path!],
      [],
      (resolvedType, resolvedField, _p, resolvedDeferred) => {
        walkField(resolvedType, resolvedField, info, config, context, resolvedDeferred, level);
      },
      deferred,
    );
    return;
  }
  if (pothosIndirectInclude) {
    walkField(
      info.schema.getType(pothosIndirectInclude.getType())!,
      selection,
      info,
      config,
      context,
      deferred,
      level,
    );
    return;
  }

  if (!(isObjectType(type) || isInterfaceType(type))) {
    return;
  }
  if (!selection.selectionSet || (deferred && config.skipDeferredFragments)) {
    return;
  }

  walkSelectionSet(type, selection.selectionSet, info, config, context, level);
}

function walkSelectionSet(
  type: GraphQLObjectType | GraphQLInterfaceType,
  selectionSet: SelectionSetNode,
  info: GraphQLResolveInfo,
  config: PothosPrismaNextConfig,
  context: object,
  level: LevelAcc,
): void {
  // Type-level always-load (`prismaObject({ select })`). Honored on
  // every descent so nested-type declarations also force into the
  // include's SELECT.
  const typeSelect = (type.extensions ?? ({} as Record<string, unknown>))[PRISMA_NEXT_SELECT] as
    | readonly string[]
    | Record<string, unknown>
    | undefined;
  if (typeSelect !== undefined) {
    applyObjectLevelSelect(typeSelect, type, info, config, context, level);
  }

  collectSelections(type, selectionSet, info, config, context, level);

  // FK augmentation: pull each included relation's localFields into
  // the parent SELECT so prisma-next's nested-stitch works at depth 2+
  // even when the GraphQL query didn't ask for the FK.
  for (const rel of level.relations.values()) {
    for (const fk of rel.parentFkColumns) {
      level.columns.add(fk);
    }
  }
}

// Assumes the operation passed GraphQL.js validation; cyclic fragments
// are rejected by the `NoFragmentCycles` rule before execution.
function collectSelections(
  type: GraphQLObjectType | GraphQLInterfaceType,
  selectionSet: SelectionSetNode,
  info: GraphQLResolveInfo,
  config: PothosPrismaNextConfig,
  context: object,
  level: LevelAcc,
): void {
  for (const sel of selectionSet.selections) {
    switch (sel.kind) {
      case Kind.FIELD:
        collectField(type, sel, info, config, context, level);
        continue;
      case Kind.FRAGMENT_SPREAD: {
        if (config.skipDeferredFragments && isDeferredFragment(sel, info)) {
          continue;
        }
        const fragment = info.fragments[sel.name.value];
        if (!fragment) {
          continue;
        }
        const fragType = info.schema.getType(fragment.typeCondition.name.value);
        if (!fragType || !fragmentApplies(type, fragType)) {
          continue;
        }
        collectSelections(
          fragType as GraphQLObjectType,
          fragment.selectionSet,
          info,
          config,
          context,
          level,
        );
        continue;
      }
      case Kind.INLINE_FRAGMENT: {
        if (config.skipDeferredFragments && isDeferredFragment(sel, info)) {
          continue;
        }
        const fragType = sel.typeCondition
          ? info.schema.getType(sel.typeCondition.name.value)
          : type;
        if (!fragType || !fragmentApplies(type, fragType)) {
          continue;
        }
        collectSelections(
          fragType as GraphQLObjectType,
          sel.selectionSet,
          info,
          config,
          context,
          level,
        );
        continue;
      }
      default:
        throw new PothosValidationError(
          `Unsupported selection kind ${(sel as { kind: string }).kind}`,
        );
    }
  }
}

function fragmentApplies(parent: GraphQLNamedType, fragType: GraphQLNamedType): boolean {
  return isObjectType(parent) ? fragType.name === parent.name : sameModel(parent, fragType);
}

function sameModel(a: GraphQLNamedType, b: GraphQLNamedType): boolean {
  const aModel = getModelNameForType(a);
  const bModel = getModelNameForType(b);
  return aModel !== undefined && aModel === bModel;
}

const POTHOS_EXPOSED_FIELD = 'pothosExposedField';
const POTHOS_FIELD_OPTIONS = 'pothosOptions';

function collectField(
  type: GraphQLObjectType | GraphQLInterfaceType,
  selection: FieldNode,
  info: GraphQLResolveInfo,
  config: PothosPrismaNextConfig,
  context: object,
  level: LevelAcc,
): void {
  if (selection.name.value.startsWith('__') || fieldSkipped(info, selection)) {
    return;
  }
  const field = type.getFields()[selection.name.value];
  if (!field) {
    throw new PothosValidationError(`Unknown field ${selection.name.value} on ${type.name}`);
  }

  const ext = (field.extensions ?? {}) as Record<string | symbol, unknown>;
  const alias = selection.alias?.value ?? selection.name.value;

  // Field-level `pothosIndirectInclude` — set by t.variant (descend
  // into the variant type's selection set on the same row). Type-level
  // `pothosIndirectInclude` on the field's return type is honored
  // separately inside walkField.
  //
  // Same-row variants also commonly carry a `select: string[]` on
  // `pothosOptions.select` for forced column reads (the variant's
  // resolver expects those columns on the parent row). Those are
  // applied to the CURRENT level (the parent row) before the
  // indirect-include descent into the named type's selection set.
  //
  // Note: only the no-path/no-paths form is honored at field level
  // (same-row redirect, e.g. t.variant). Paths-form indirect-includes
  // (e.g. t.relatedConnection wrapping a connection) are handled by
  // the function-form `pothosOptions.select` callback in the sugar
  // itself, where the descent applies to the relation collection
  // — not the parent row. The walker treats the field as a normal
  // function-form select and lets the callback descend internally
  // via `applySelectionToCollection` with the connection's paths.
  const fieldIndirect = ext.pothosIndirectInclude as IndirectInclude | undefined;
  if (
    fieldIndirect &&
    (!fieldIndirect.path || fieldIndirect.path.length === 0) &&
    (!fieldIndirect.paths || fieldIndirect.paths.length === 0)
  ) {
    // Apply the field-level select option's column-array form (forced
    // column reads — t.variant's `select` option compiles to this).
    const opts = ext[POTHOS_FIELD_OPTIONS] as
      | { select?: readonly string[] | Record<string, unknown> | ((...args: unknown[]) => unknown) }
      | undefined;
    if (Array.isArray(opts?.select)) {
      for (const col of opts!.select) {
        if (typeof col === 'string') {
          level.columns.add(col);
        }
      }
    }
    if (!selection.selectionSet) {
      return;
    }
    const target = info.schema.getType(fieldIndirect.getType());
    if (!target) {
      return;
    }
    // Same-row descent: walk the target type against the same
    // selection node so its selection set drives the column reads on
    // this level.
    walkField(target, selection, info, config, context, false, level);
    return;
  }

  // Scalar / computed field column dependencies:
  //   pothosExposedField — core sets this on every `t.exposeX(name, …)`.
  //   pothosOptions.select — typed `select` augmentation from t.field({ select, resolve }).
  const exposed = ext[POTHOS_EXPOSED_FIELD];
  if (typeof exposed === 'string') {
    level.columns.add(exposed);
  }
  const opts = ext[POTHOS_FIELD_OPTIONS] as
    | {
        select?:
          | readonly string[]
          | ((args: unknown, ctx: unknown) => readonly string[])
          | Record<string, unknown>
          | ((args: unknown, ctx: unknown) => Record<string, unknown>);
      }
    | undefined;
  if (opts?.select === undefined) {
    return;
  }

  // Resolve callback form once. Arg-walks are O(args) and we may run
  // this per-resolve, but `select` resolution is idempotent for a
  // given selection so it's fine.
  //
  // The callback's public signature is `(args, ctx) => spec`. Internal
  // sugar (t.relatedConnection) extends to
  // `(args, ctx, info, selection, returnType)` so it can decide e.g.
  // whether to emit a synthetic `count` entry based on whether the
  // client selected `totalCount`, and descend into the connection
  // type's selection set to collect column reads. Public users ignore
  // the extra args by virtue of JS calling convention.
  let resolved: unknown = opts.select;
  if (typeof resolved === 'function') {
    const args = getMappedArgumentValues(field, selection, context, info) as Record<
      string,
      unknown
    >;
    const fieldReturnType = getNamedType(field.type);
    resolved = (
      resolved as (
        a: unknown,
        c: unknown,
        info: GraphQLResolveInfo,
        selection: FieldNode,
        returnType: GraphQLNamedType,
      ) => unknown
    )(args, context, info, selection, fieldReturnType);
  }

  if (Array.isArray(resolved)) {
    // Legacy array form: pure column reads.
    for (const col of resolved) {
      if (typeof col === 'string') {
        level.columns.add(col);
      }
    }
    return;
  }
  if (!resolved || typeof resolved !== 'object') {
    return;
  }

  // Object-form select: mixed columns + relation includes. Each key
  // is either a column (→ added to parent SELECT) or a relation.
  // Relation entries with `true` get a default include; with a
  // function `(sub, args, ctx) => spec`, the function is stored and
  // invoked at render time to produce combine spec entries
  // (counts/aggregates/refined includes/future SQL).
  //
  // Branch / spec keys are namespaced `<fieldAlias>:<specKey>` so
  // multiple consumers on the same relation never collide.
  const relationsMeta = getRelationsMetaForType(type);
  const columnsMeta = getColumnsForType(type);
  const resolvedArgs = (): Record<string, unknown> =>
    getMappedArgumentValues(field, selection, context, info) as Record<string, unknown>;

  for (const [key, value] of Object.entries(resolved as Record<string, unknown>)) {
    if (value === false) {
      continue;
    }
    const relMeta = relationsMeta?.[key];
    const isKnownColumn = columnsMeta?.has(key) ?? true;
    if (value === true) {
      if (relMeta !== undefined) {
        // Relation: emit a branch with nested selection if the
        // field's GraphQL return type is the related model (sugar
        // path — `t.relation('posts')` returns Post[]; nested
        // `{ author { id } }` selections need to recurse). For a
        // plain `t.field({ select: { posts: true } })` returning a
        // scalar, the field's nested selection is empty and we pass
        // a no-op descend.
        const branchAlias = selectBranchAlias(alias, key);
        const innerType = getNamedType(field.type);
        addBranch(
          level,
          key,
          relMeta.isToMany,
          branchAlias,
          {
            args: {},
            descend: makeBranchDescend(innerType, selection, info, config, context, false),
          },
          relMeta.localFields,
        );
      } else if (isKnownColumn) {
        // Treat as a column read on the parent model.
        level.columns.add(key);
      } else {
        throw new PothosValidationError(
          `select: '${key}' is not a column or relation on ${type.name}. ` +
            'Check for a typo, or register the field via the contract.',
        );
      }
    } else if (isDeclarativeRefineSpec(value)) {
      // Declarative refine `{ where, orderBy, take, skip }` — stays
      // on the single-consumer fast path (no combine wrap). Scalar
      // terminals can't appear here by type construction;
      // counts/aggregates/multi-variant must use function form.
      if (relMeta === undefined) {
        throw new PothosValidationError(
          `select: '${key}' has a { where, take, skip, orderBy } entry but is not a relation on ${type.name}.`,
        );
      }
      const branchAlias = selectBranchAlias(alias, key);
      const innerType = getNamedType(field.type);
      addBranch(
        level,
        key,
        relMeta.isToMany,
        branchAlias,
        {
          args: resolvedArgs(),
          refine: (rel) => compileDeclarativeRefine(value)(rel),
          descend: makeBranchDescend(innerType, selection, info, config, context, false),
        },
        relMeta.localFields,
      );
    } else if (typeof value === 'function') {
      if (relMeta === undefined) {
        throw new PothosValidationError(
          `select: '${key}' has a function value but is not a relation on ${type.name}.`,
        );
      }
      // Defer to emit time. The function receives the real
      // prisma-next refinement collection for this relation.
      const rel = getOrCreateRelation(level, key, relMeta.isToMany);
      // FK augmentation also fires when only function-form entries
      // exist on a relation — the count or refined branch the
      // function emits still reads against the join.
      if (rel.parentFkColumns.length === 0 && relMeta.localFields.length > 0) {
        rel.parentFkColumns = relMeta.localFields;
      }
      rel.specFunctions.push({
        fieldAlias: alias,
        args: resolvedArgs(),
        fn: value as (
          sub: unknown,
          args: Record<string, unknown>,
          ctx: unknown,
        ) => Record<string, unknown>,
      });
    } else if (value !== undefined && value !== null) {
      // Anything that isn't true/false/declarative/function is a
      // malformed spec. Most common cause: a typo in declarative-keys
      // like `{ posts: { whre: ... } }`, which silently dropped before
      // this guard.
      throw new PothosValidationError(
        `select: '${key}' has an unrecognized value shape. Use \`true\`, ` +
          '`{ where?, orderBy?, take?, skip? }`, or a function ' +
          '`(sub, args, ctx) => spec`.',
      );
    }
  }
}

/**
 * Declarative refine: `{ where?, orderBy?, take?, skip? }`. Matches
 * the surface of the legacy `query` option. The mapper compiles this
 * into a branch refine that applies the chain at emit time. No scalar
 * terminals allowed by construction — anything else must go through
 * function-form.
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
function compileDeclarativeRefine(spec: DeclarativeRefineSpec) {
  return (rel: unknown): unknown => {
    let r = rel as {
      where: (input: unknown) => unknown;
      orderBy: (callback: unknown) => unknown;
      take: (n: number) => unknown;
      skip: (n: number) => unknown;
    };
    if (spec.where !== undefined) {
      r = r.where(spec.where) as typeof r;
    }
    if (spec.orderBy !== undefined) {
      r = r.orderBy(spec.orderBy) as typeof r;
    }
    if (spec.take !== undefined) {
      r = r.take(spec.take) as typeof r;
    }
    if (spec.skip !== undefined) {
      r = r.skip(spec.skip) as typeof r;
    }
    return r;
  };
}

/**
 * Combine-slot key separator. `:` is forbidden by GraphQL's Name
 * grammar (/^[_A-Za-z][_0-9A-Za-z]*$/), so combine keys produced by
 * the walker can NEVER collide with user-provided GraphQL aliases or
 * relation names. This eliminates the prototype-pollution + reserved-
 * alias defense entirely — keys are unforgeable from user input.
 *
 * Object-level selects prefix with `:object:<typeName>` so variants
 * sharing a row but declaring distinct object-level selects route to
 * distinct combine slots.
 */
const COMBINE_SEPARATOR = ':';
const OBJECT_LEVEL_PREFIX = `${COMBINE_SEPARATOR}object${COMBINE_SEPARATOR}`;

export function objectLevelFieldAlias(typeName: string): string {
  return `${OBJECT_LEVEL_PREFIX}${typeName}`;
}

export function objectLevelBranchAlias(typeName: string, specKey: string): string {
  return `${objectLevelFieldAlias(typeName)}${COMBINE_SEPARATOR}${specKey}`;
}

/**
 * Process an object-level select declared on `prismaObject({ select })`.
 * Supports the legacy column-name array form and the new object form
 * (columns + relations with simple-include or function-form entries).
 */
function applyObjectLevelSelect(
  spec: readonly string[] | Record<string, unknown>,
  type: GraphQLObjectType | GraphQLInterfaceType,
  info: GraphQLResolveInfo,
  _config: PothosPrismaNextConfig,
  context: object,
  level: LevelAcc,
): void {
  if (Array.isArray(spec)) {
    for (const col of spec) {
      if (typeof col === 'string') {
        level.columns.add(col);
      }
    }
    return;
  }
  const relationsMeta = getRelationsMetaForType(type);
  const columnsMeta = getColumnsForType(type);
  for (const [key, value] of Object.entries(spec as Record<string, unknown>)) {
    if (value === false) {
      continue;
    }
    const relMeta = relationsMeta?.[key];
    const isKnownColumn = columnsMeta?.has(key) ?? true;
    if (value === true) {
      if (relMeta !== undefined) {
        // Empty-inner branch — no field-node descent. The .include
        // callback runs the (no-op) refine/pagination wrappers and
        // returns the relation collection unchanged.
        addBranch(
          level,
          key,
          relMeta.isToMany,
          objectLevelBranchAlias(type.name, key),
          {
            args: {},
            descend: (rel) => rel,
          },
          relMeta.localFields,
        );
      } else if (isKnownColumn) {
        level.columns.add(key);
      } else {
        throw new PothosValidationError(
          `prismaObject select: '${key}' is not a column or relation on ${type.name}. ` +
            'Check for a typo, or register the field via the contract.',
        );
      }
    } else if (typeof value === 'function') {
      if (relMeta === undefined) {
        throw new PothosValidationError(
          `prismaObject select: '${key}' has a function value but is not a relation on ${type.name}.`,
        );
      }
      const rel = getOrCreateRelation(level, key, relMeta.isToMany);
      if (rel.parentFkColumns.length === 0 && relMeta.localFields.length > 0) {
        rel.parentFkColumns = relMeta.localFields;
      }
      // Per-type fieldAlias means inner combine keys render as
      // `:object:<TypeName>:<innerKey>` — distinct namespace per type,
      // so variants with their own object-level selects on the same
      // row don't collide.
      rel.specFunctions.push({
        fieldAlias: objectLevelFieldAlias(type.name),
        args: {},
        fn: value as (
          sub: unknown,
          args: Record<string, unknown>,
          ctx: unknown,
        ) => Record<string, unknown>,
      });
    } else if (value !== undefined && value !== null) {
      // Same fallthrough error as field-level select for malformed
      // shapes (typos in declarative keys).
      throw new PothosValidationError(
        `prismaObject select: '${key}' has an unrecognized value shape. ` +
          'Use `true`, or a function `(sub) => spec`.',
      );
    }
  }
  // `info` and `context` are reserved in the signature for the
  // future args-dependent object-level entries path; they're unused
  // today but plumbed so adding that doesn't break callers.
}

// ---------------------------------------------------------------------
// Branch descent helpers.
// ---------------------------------------------------------------------

/**
 * Build the recursive descent for a non-paginated branch: walks the
 * given (inner) type against the same FieldNode (so its selection set
 * is re-used), then emits the inner level onto the relation
 * collection. Closes over info/config/context.
 */
function makeBranchDescend(
  innerType: GraphQLNamedType,
  selection: FieldNode,
  info: GraphQLResolveInfo,
  config: PothosPrismaNextConfig,
  context: object,
  deferred: boolean,
): (rel: MapperCollection) => MapperCollection {
  // For scalar inner types (rare — e.g. `t.field({ select: { posts:
  // true } })` returning Int) the walker emits no columns and no
  // includes; the result is the relation collection unchanged.
  if (!(isObjectType(innerType) || isInterfaceType(innerType))) {
    return (rel) => rel;
  }
  return (rel) => {
    const inner = newLevel();
    walkField(innerType, selection, info, config, context, deferred, inner);
    return emitLevel(inner, rel, context, config);
  };
}

// ---------------------------------------------------------------------
// Emission — turn a level into chain calls.
// ---------------------------------------------------------------------

function emitLevel(
  level: LevelAcc,
  base: MapperCollection,
  context: object,
  config: PothosPrismaNextConfig,
): MapperCollection {
  let acc = base;
  if (level.columns.size > 0) {
    acc = acc.select(...level.columns);
  }
  for (const [relationName, relation] of level.relations) {
    acc = emitRelation(acc, relationName, relation, context, config);
  }
  return acc;
}

// Single-consumer fast path: `.include(rel, cb => …)` direct — to-one
// relations and to-many with exactly one branch + no scalars. Multi-
// consumer or any scalar (count/aggregate/spec-fn) goes through
// `.combine({...})` for collision-free aliasing — prisma-next's
// planner falls back to multi-query for any include with combine
// (painpoint #3), so we keep the single-consumer path for perf.
function emitRelation(
  parent: MapperCollection,
  relationName: string,
  relation: RelationAcc,
  context: object,
  config: PothosPrismaNextConfig,
): MapperCollection {
  const useCombine =
    relation.isToMany &&
    (relation.counts.size > 0 || relation.branches.size > 1 || relation.specFunctions.length > 0);

  if (!useCombine) {
    const next = relation.branches.entries().next();
    if (next.done) {
      // No branches at all (only a function-form spec-fn returning a
      // scalar, but useCombine demoted because not to-many). Emit a
      // no-refine include so the relation still preloads.
      return parent.include(relationName);
    }
    const [, branch] = next.value;
    return parent.include(relationName, (rel) => emitBranch(branch, rel, context, config));
  }

  return parent.include(relationName, (rel) => {
    // Combine spec keys are namespaced with `:` (GraphQL-forbidden), so
    // collisions with reserved JS object keys can't be forged from user
    // input. A plain object is safe.
    const spec: Record<string, unknown> = {};
    for (const [alias, branch] of relation.branches) {
      spec[alias] = emitBranch(branch, rel, context, config);
    }
    for (const [alias, count] of relation.counts) {
      spec[alias] = emitCount(count, rel, context);
    }
    for (const sf of relation.specFunctions) {
      const userSpec = sf.fn(rel, sf.args, context);
      if (userSpec && typeof userSpec === 'object') {
        const prefix = fieldAliasPrefix(sf.fieldAlias);
        for (const innerKey of Object.keys(userSpec)) {
          spec[`${prefix}${innerKey}`] = (userSpec as Record<string, unknown>)[innerKey];
        }
      }
    }
    return rel.combine(spec);
  });
}

function emitBranch(
  branch: BranchAcc,
  rel: MapperCollection,
  context: object,
  _config: PothosPrismaNextConfig,
): MapperCollection {
  let r = rel;
  // `refine` (compiled from the user's declarative refine or `query`
  // option) runs before the inner descent so the filter applies to
  // the row set the inner selection columns are read against.
  if (branch.refine) {
    const refined = branch.refine(r, branch.args, context);
    if (refined != null) {
      r = refined as MapperCollection;
    }
  }
  return branch.descend(r);
}

function emitCount(count: CountAcc, rel: MapperCollection, context: object): unknown {
  let r = rel;
  if (count.refine) {
    const refined = count.refine(r, count.args, context);
    if (refined != null) {
      r = refined as MapperCollection;
    }
  }
  if (count.where === undefined) {
    return r.count();
  }
  if (typeof count.where === 'function') {
    const whereFn = count.where as (accessor: unknown, args: unknown, ctx: unknown) => unknown;
    return r.where((accessor: unknown) => whereFn(accessor, count.args, context)).count();
  }
  return r.where(count.where).count();
}

// ---------------------------------------------------------------------
// Bookkeeping for relation branches.
// ---------------------------------------------------------------------

/**
 * Naming convention for branches contributed by the object-form `select`
 * option on a `t.field`. Combine slot key = `<graphqlFieldAlias>:<specKey>`.
 * The `:` is GraphQL-forbidden, so combine keys can't collide with user
 * aliases or relation names. The per-field wrap uses the same scheme to
 * read results back.
 */
export function selectBranchAlias(fieldAlias: string, specKey: string): string {
  return `${fieldAlias}${COMBINE_SEPARATOR}${specKey}`;
}

/** @internal — also used by the per-field overlay in the plugin index. */
export function fieldAliasPrefix(fieldAlias: string): string {
  return `${fieldAlias}${COMBINE_SEPARATOR}`;
}

// To-one relations can't carry multiple branches — the orm returns
// one row, so sibling aliases would each want their own refined view
// of the same row.
function addBranch(
  level: LevelAcc,
  relationName: string,
  isToMany: boolean,
  alias: string,
  branch: BranchAcc,
  parentFkColumns: readonly string[],
): void {
  const rel = getOrCreateRelation(level, relationName, isToMany);
  if (!isToMany && rel.branches.size > 0) {
    throw new PothosValidationError(
      `Relation "${relationName}" is to-one — only one branch allowed, got alias "${alias}" plus ${[...rel.branches.keys()].map((a) => `"${a}"`).join(', ')}.`,
    );
  }
  if (rel.branches.has(alias)) {
    throw new PothosValidationError(`Duplicate alias "${alias}" for relation "${relationName}"`);
  }
  rel.branches.set(alias, branch);
  // First branch to register its localFields claims the slot. All
  // branches on the same relation share the same FK columns; only
  // record once.
  if (rel.parentFkColumns.length === 0 && parentFkColumns.length > 0) {
    rel.parentFkColumns = parentFkColumns;
  }
}

// ---------------------------------------------------------------------
// Extension probes.
// ---------------------------------------------------------------------

interface RelationMetaShape {
  readonly isToMany: boolean;
  readonly localFields: readonly string[];
  readonly targetModel: string;
}

function getRelationsMetaForType(
  type: GraphQLNamedType,
): Record<string, RelationMetaShape> | undefined {
  const ext = (type.extensions ?? {}) as Record<string, unknown>;
  return ext[PRISMA_NEXT_RELATIONS] as Record<string, RelationMetaShape> | undefined;
}

function getColumnsForType(type: GraphQLNamedType): ReadonlySet<string> | undefined {
  const ext = (type.extensions ?? {}) as Record<string, unknown>;
  return ext[PRISMA_NEXT_COLUMNS] as ReadonlySet<string> | undefined;
}

function getModelNameForType(type: GraphQLNamedType): string | undefined {
  const ext = (type.extensions ?? {}) as Record<string, unknown>;
  return ext[PRISMA_NEXT_MODEL] as string | undefined;
}

function fieldSkipped(info: GraphQLResolveInfo, selection: FieldNode): boolean {
  // Short-circuit on directive-less fields — getDirectiveValues
  // allocates per call.
  if (!selection.directives?.length) {
    return false;
  }
  const skip = getDirectiveValues(GraphQLSkipDirective, selection, info.variableValues);
  if (skip?.if === true) {
    return true;
  }
  const include = getDirectiveValues(GraphQLIncludeDirective, selection, info.variableValues);
  if (include?.if === false) {
    return true;
  }
  return false;
}

function isDeferredFragment(
  node: FragmentSpreadNode | InlineFragmentNode,
  info: GraphQLResolveInfo,
): boolean {
  if (!node.directives?.length) {
    return false;
  }
  const deferDirective = info.schema.getDirective('defer');
  if (!deferDirective) {
    return false;
  }
  const defer = getDirectiveValues(deferDirective, node, info.variableValues);
  return !!defer && defer.if !== false;
}

// ---------------------------------------------------------------------
// Indirect-include traversal — descends through `path`/`paths` so a
// plugin (e.g. plugin-errors) can wrap a relation in a result-union
// and have the inner connection / nested relation still preload.
// ---------------------------------------------------------------------

function resolveIndirectIncludePaths(
  type: GraphQLNamedType,
  info: GraphQLResolveInfo,
  selection: FieldNode | FragmentDefinitionNode | InlineFragmentNode,
  pathPrefix: { type?: string; name: string }[],
  includePaths: { type?: string; name: string }[][],
  path: string[],
  resolve: (type: GraphQLNamedType, field: FieldNode, path: string[], deferred: boolean) => void,
  deferred?: boolean,
): void {
  for (const includePath of includePaths) {
    const full = pathPrefix.length > 0 ? [...pathPrefix, ...includePath] : includePath;
    resolveIndirectInclude(type, info, selection, full, path, resolve, deferred);
  }
}

// Assumes the operation passed GraphQL.js validation; cyclic fragments
// are rejected by the `NoFragmentCycles` rule before execution.
function resolveIndirectInclude(
  type: GraphQLNamedType,
  info: GraphQLResolveInfo,
  selection: FieldNode | FragmentDefinitionNode | InlineFragmentNode,
  includePath: { type?: string; name: string }[],
  path: string[],
  resolve: (type: GraphQLNamedType, field: FieldNode, path: string[], deferred: boolean) => void,
  deferred = false,
): void {
  if (includePath.length === 0) {
    resolve(type, selection as FieldNode, path, deferred);
    return;
  }
  const [include, ...rest] = includePath;
  if (!selection.selectionSet || !include) {
    return;
  }

  for (const sel of selection.selectionSet.selections) {
    switch (sel.kind) {
      case Kind.FIELD:
        if (
          !fieldSkipped(info, sel) &&
          sel.name.value === include.name &&
          (isObjectType(type) || isInterfaceType(type))
        ) {
          const returnType = getNamedType(type.getFields()[sel.name.value]!.type);
          resolveIndirectInclude(
            returnType,
            info,
            sel,
            rest,
            [...path, sel.alias?.value ?? sel.name.value],
            resolve,
            deferred,
          );
        }
        continue;
      case Kind.FRAGMENT_SPREAD: {
        const fragment = info.fragments[sel.name.value];
        if (!fragment) {
          continue;
        }
        if (!include.type || fragment.typeCondition.name.value === include.type) {
          resolveIndirectInclude(
            include.type ? info.schema.getType(include.type)! : type,
            info,
            fragment,
            includePath,
            path,
            resolve,
            deferred || isDeferredFragment(sel, info),
          );
        }
        continue;
      }
      case Kind.INLINE_FRAGMENT:
        if (!sel.typeCondition || !include.type || sel.typeCondition.name.value === include.type) {
          resolveIndirectInclude(
            sel.typeCondition ? info.schema.getType(sel.typeCondition.name.value)! : type,
            info,
            sel,
            includePath,
            path,
            resolve,
            deferred || isDeferredFragment(sel, info),
          );
        }
        continue;
      default:
        throw new PothosValidationError(
          `Unsupported selection kind ${(sel as { kind: string }).kind}`,
        );
    }
  }
}
