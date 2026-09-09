import { getMappedArgumentValues, PothosValidationError } from '@pothos/core';
import {
  type FieldNode,
  type FragmentDefinitionNode,
  type GraphQLField,
  type GraphQLInterfaceType,
  type GraphQLNamedType,
  type GraphQLObjectType,
  type GraphQLResolveInfo,
  getNamedType,
  type InlineFragmentNode,
  isAbstractType,
  isInterfaceType,
  isObjectType,
  Kind,
  type SelectionNode,
} from 'graphql';
import { type Mapping, type Mappings, setLoaderMappings } from './loader-map.js';
import {
  findMatches,
  type IndirectInclude,
  type IndirectPathSegment,
  includeOf,
  isDeferred,
  isSkipped,
  normalizeInclude,
  type PathSegment,
  resolveType,
} from './matches.js';
import { createNode, type Node } from './node.js';
import { wrapWithUsageCheck } from './usage.js';

type WalkedType = GraphQLInterfaceType | GraphQLObjectType;

/**
 * The callback handed to a field's select function to plan the selection beneath the field:
 * `query` is merged first (a function is called with the field's args, `true` means no query),
 * then the selection found under `path` (an explicit include, or a string path from the field's
 * return type) is walked as `type` (or the field's return type).
 */
export type NestedSelection<Map, X = undefined> = (
  query?: Map | true | ((args: object, ctx: object, extra: X) => Map | null | undefined),
  path?: string[] | IndirectInclude,
  type?: string,
) => Map;

/** A function field selection (S-6). A falsy result selects nothing (S-5). */
export type SelectFn<Map, X = undefined> = (
  args: object,
  ctx: object,
  nested: NestedSelection<Map, X>,
  getSelectedNode: (path: string[]) => FieldNode | null,
  extra: X,
) => Map | false | null | undefined;

export interface EntryOptions<Map> {
  context: object;
  info: GraphQLResolveInfo;
  typeName?: string;
  path?: PathSegment[];
  paths?: PathSegment[][];
  /** Merged into the root before anything is walked (E-1). */
  initial?: Map;
  /** Returned when paths are given and nothing is selected under them; defaults to `initial`. */
  noMatch?: Map;
  skipDeferredFragments?: boolean;
  withUsageCheck?: boolean;
}

/**
 * The ORM boundary. `M` is the model description a `Node` carries, `Map` the ORM's own selection
 * format (prisma `{ select, include, ...args }`, drizzle `DBQueryConfig`), `X` an adapter-owned
 * value threaded from a walk to the select functions beneath it (drizzle's `PathInfo`).
 */
export interface Adapter<M, Map, X = undefined> {
  skipDeferredFragments: boolean;
  /**
   * The map that selects nothing. A relation query is spread over it so a query without
   * select/columns does not mean "all columns".
   */
  empty: Map;
  /**
   * The model a type carries, or undefined. Does not follow indirect includes (`Env.modelOf`
   * does). One object per model: identity is model identity.
   */
  modelFor(type: GraphQLNamedType): M | undefined;
  /** S-1: what the type always needs, or undefined. */
  typeSelection(type: GraphQLNamedType): Map | undefined;
  /** S-4..S-6: a static map, a select function, or nothing. */
  fieldSelection(field: GraphQLField<unknown, unknown>): Map | SelectFn<Map, X> | undefined;
  /** M-1, M-2, S-9, in place. Never mutates `map`. Child nodes come only from `relation()`. */
  merge(node: Node<M>, map: Map): void;
  /**
   * M-3: relations present in both are compatible recursively (arguments deep-equal below the
   * top); extras present in both are equal. With `ignoreArgs` the node's own arguments are not
   * compared.
   */
  compatible(node: Node<M>, map: Map, ignoreArgs: boolean): boolean;
  /**
   * S-7: the first relation (arguments compared by value) or extra (compared as the adapter
   * compares extras) of a type-level `map` that conflicts with what `node` already holds.
   */
  typeLevelConflict(node: Node<M>, map: Map): TypeLevelConflict | undefined;
  /** E-2: `map` without the relations and extras whose arguments conflict with `node`. */
  withoutConflicts(node: Node<M>, map: Map): Map;
  /** M-6. */
  serialize(node: Node<M>): Map;
  /**
   * D-7: the extra handed to the select function of `field` (selected by `node` on `type`), built
   * from the extra of the walk it hangs beneath. Called once per entry point for the resolved
   * field and once per function-select field.
   */
  callbackExtra?(
    parent: X | undefined,
    type: WalkedType,
    field: GraphQLField<unknown, unknown>,
    node: FieldNode,
  ): X;
  /**
   * S-7: how to walk a fragment on `condition` while walking `type`: as `type`, as `condition`
   * (a variant of the same model, whose type-level selection is merged), or not at all
   * (undefined: its fields are suppressed, nested fragments are still classified against `type`).
   * `declared` is the declared return type of the field being walked, before any indirect
   * include is followed. Defaults to `defaultFragmentType`.
   */
  fragmentType?(
    type: WalkedType,
    condition: GraphQLNamedType,
    declared: GraphQLNamedType,
  ): WalkedType | undefined;
}

/** A type-level selection entry that cannot be merged with what a node already holds. */
export interface TypeLevelConflict {
  kind: 'extra' | 'relation';
  name: string;
}

/** What one entry-point call runs with, shared by reference with every nested walk. */
export interface Env<M, Map, X = undefined> {
  adapter: Adapter<M, Map, X>;
  context: object;
  info: GraphQLResolveInfo;
  skipDeferred: boolean;
  /** The model of a type, following indirect includes. */
  modelOf: (type: GraphQLNamedType) => M | undefined;
}

/** One root being built: its query tree and the mappings recorded beneath it. */
export interface Walk<M, Map, X = undefined> {
  env: Env<M, Map, X>;
  root: Node<M>;
  mappings: Mappings;
  /** D-7: the extra of the field this walk hangs beneath. */
  extra?: X;
}

/** The mapping of a static selection: nothing can ever be recorded beneath one. */
const NONE: Mapping = Object.freeze({ nested: Object.freeze({}) as Mappings });

/** E-1: the query for the field `info` resolves, with its loader mappings recorded (L-2). */
export function queryFromInfo<M, Map extends object, X = undefined>(
  adapter: Adapter<M, Map, X>,
  options: EntryOptions<Map>,
): Map {
  const walk = buildWalk(makeEnv(adapter, options), options);

  if (!walk) {
    // Nothing is selected under the paths: there is nothing to plan and nothing to map, so the
    // caller gets back its own selection.
    return wrap(options.noMatch ?? options.initial ?? ({} as Map), options.withUsageCheck);
  }

  return finish(walk, emitQuery, options.withUsageCheck);
}

/** E-1 without paths: the walk itself, nothing recorded. Always produces a walk. */
export function walkFromInfo<M, Map extends object, X = undefined>(
  adapter: Adapter<M, Map, X>,
  options: EntryOptions<Map>,
): Walk<M, Map, X> {
  return finish(buildWalk(makeEnv(adapter, options), options)!, identity);
}

/**
 * E-2: the walk loading the field `info` resolves for its parent row. The loaded row replaces the
 * parent the field resolver sees, so besides the field's own selection it carries the parent
 * type's type-level selection. The field is what the row is loaded for, so it is merged first
 * and a type-level relation whose arguments conflict with it is left out.
 */
export function selectionStateFromInfo<M, Map extends object, X = undefined>(
  adapter: Adapter<M, Map, X>,
  context: object,
  info: GraphQLResolveInfo,
  skipDeferredFragments?: boolean,
): Walk<M, Map, X> {
  const env = makeEnv(adapter, { context, info, skipDeferredFragments });
  const type = info.parentType;
  const walk = createWalk(env, type, {});

  // Every node selecting the field (one per fragment it appears under) plans into the same row,
  // so the loaded row satisfies each of them.
  for (const fieldNode of info.fieldNodes) {
    applyField(walk, walk.root, type, fieldNode, []);
  }

  const selection = adapter.typeSelection(type);

  if (selection) {
    adapter.merge(walk.root, adapter.withoutConflicts(walk.root, selection));
  }

  return finish(walk, identity);
}

/**
 * The default S-7 classification: a fragment on the type itself or on an interface it implements
 * walks as the type; a fragment on another type of the same model walks as that type. An object
 * variant is only entered when the field's declared type is abstract: under a concrete field type
 * the variant can never be the runtime type, so its selection is not needed.
 */
export function defaultFragmentType<M>(
  adapter: Pick<Adapter<M, unknown, unknown>, 'modelFor'>,
  type: WalkedType,
  condition: GraphQLNamedType,
  declared: GraphQLNamedType,
): WalkedType | undefined {
  if (condition === type) {
    return type;
  }

  if (isInterfaceType(condition) && type.getInterfaces().includes(condition)) {
    return type;
  }

  if (isInterfaceType(condition) || (isObjectType(condition) && isAbstractType(declared))) {
    const model = adapter.modelFor(condition);

    if (model && model === adapter.modelFor(type)) {
      return condition;
    }
  }

  return undefined;
}

/** The single exit of every entry point, so async completion can be added here later. */
function finish<M, Map, X, A, R>(
  walk: Walk<M, Map, X>,
  done: (walk: Walk<M, Map, X>, arg: A) => R,
  arg?: A,
): R {
  return done(walk, arg as A);
}

function identity<M, Map, X>(walk: Walk<M, Map, X>) {
  return walk;
}

function serializeRoot<M, Map, X>(walk: Walk<M, Map, X>) {
  return walk.env.adapter.serialize(walk.root);
}

/** L-2, M-6, L-5 in that order. */
function emitQuery<M, Map extends object, X>(walk: Walk<M, Map, X>, withUsageCheck?: boolean) {
  setLoaderMappings(walk.env.context, walk.env.info, walk.mappings);

  return wrap(walk.env.adapter.serialize(walk.root), withUsageCheck);
}

function wrap<Map extends object>(query: Map, withUsageCheck?: boolean) {
  return withUsageCheck ? wrapWithUsageCheck(query) : query;
}

function makeEnv<M, Map, X>(
  adapter: Adapter<M, Map, X>,
  {
    context,
    info,
    skipDeferredFragments,
  }: Pick<EntryOptions<Map>, 'context' | 'info'> & {
    skipDeferredFragments?: boolean;
  },
): Env<M, Map, X> {
  return {
    adapter,
    context,
    info,
    skipDeferred: skipDeferredFragments ?? adapter.skipDeferredFragments,
    modelOf: (type) => adapter.modelFor(resolveType(info.schema, type)),
  };
}

/** E-1: undefined when paths are given and nothing is selected under them. */
function buildWalk<M, Map, X>(
  env: Env<M, Map, X>,
  { typeName, path, paths, initial }: EntryOptions<Map>,
): Walk<M, Map, X> | undefined {
  const { info } = env;
  const returnType = getNamedType(info.returnType);
  const target = typeName ? info.schema.getType(typeName)! : returnType;
  const extra = rootExtra(env);

  // graphql merges every occurrence of the field's response key into `info.fieldNodes`; each is
  // planned into the one root, so the query answers whichever occurrence a resolver runs for.
  if (paths?.length || path?.length) {
    const includePaths = normalizePaths(paths?.length ? paths : [path!]);
    const options = {
      prefix: includeOf(returnType)?.path,
      targetType: target,
      modelOf: env.modelOf,
    };
    const matches = info.fieldNodes.flatMap((fieldNode) =>
      findMatches(info, returnType, fieldNode, includePaths, options),
    );

    if (matches.length === 0) {
      return undefined;
    }

    const walk = createWalk(env, typeName ? target : matches[0].type, {}, extra, initial);

    for (const match of matches) {
      // A matched type with its own model (including variants of the target model) is walked
      // with its own model. Types without a model (interfaces, wrappers) are walked as the
      // requested type so its fields can be found.
      const walkType = typeName && !env.modelOf(match.type) ? target : match.type;

      walkFields(walk, walk.root, walkType, match.type, [match.field], match.path, match.deferred);
    }

    return walk;
  }

  const walk = createWalk(env, target, {}, extra, initial);

  walkFields(walk, walk.root, target, returnType, info.fieldNodes, [], false);

  return walk;
}

/** D-7: the extra for the resolved field itself, which starts the extras of the fields beneath. */
function rootExtra<M, Map, X>({ adapter, info }: Env<M, Map, X>): X | undefined {
  const node = info.fieldNodes[0];
  const field = info.parentType.getFields()[node.name.value];

  return field && adapter.callbackExtra
    ? adapter.callbackExtra(undefined, info.parentType, field, node)
    : undefined;
}

function normalizePaths(paths: PathSegment[][]): IndirectPathSegment[][] {
  return paths.map((path) =>
    path.map((segment) => (typeof segment === 'string' ? { name: segment } : segment)),
  );
}

function createWalk<M, Map, X>(
  env: Env<M, Map, X>,
  type: GraphQLNamedType,
  mappings: Mappings,
  extra?: X,
  initial?: Map,
): Walk<M, Map, X> {
  const model = env.modelOf(type);

  if (!model) {
    throw new PothosValidationError(
      `Expected ${resolveType(env.info.schema, type).name} to have a model`,
    );
  }

  const walk: Walk<M, Map, X> = { env, root: createNode(model), mappings, extra };

  if (initial) {
    env.adapter.merge(walk.root, initial);
  }

  // Not entered: a type is entered when its selection set is walked (S-1).
  return walk;
}

/** S-1. */
function enter<M, Map, X>(walk: Walk<M, Map, X>, node: Node<M>, type: GraphQLNamedType) {
  const selection = walk.env.adapter.typeSelection(type);

  if (selection) {
    walk.env.adapter.merge(node, selection);
  }
}

/**
 * S-7: merges the type-level selection of `variant` when a fragment moves the walk from `type` to
 * another type of the same model, so the variant's resolvers find what its selection promises.
 * Unlike a field-level select, a type-level selection has no per-field fallback, so relation
 * arguments or extras that conflict with what is already selected are an error.
 */
function enterVariant<M, Map, X>(
  walk: Walk<M, Map, X>,
  node: Node<M>,
  type: WalkedType,
  variant: WalkedType,
) {
  const { adapter } = walk.env;
  const selection = adapter.typeSelection(variant);

  if (!selection) {
    return;
  }

  const conflict = adapter.typeLevelConflict(node, selection);

  if (conflict?.kind === 'relation') {
    throw new PothosValidationError(
      `Type-level selections of ${type.name} and ${variant.name} conflict on relation "${conflict.name}". Move the relation arguments to a field-level select on one of the types.`,
    );
  }

  if (conflict) {
    throw new PothosValidationError(
      `Type-level selections of ${type.name} and ${variant.name} conflict on extra "${conflict.name}". Define the extra with the same function on both types, or move it to a field-level select on one of the types.`,
    );
  }

  adapter.merge(node, selection);
}

/**
 * E-4, S-1, S-8: walks the selection sets of `fieldNodes` (every node selecting one field, as
 * `type`) into `node`. `declared` is the field's declared return type, which decides how
 * fragments are classified. Variants are entered across every node before any field is merged,
 * so the plan does not depend on which occurrence of the field comes first.
 */
function walkFields<M, Map, X>(
  walk: Walk<M, Map, X>,
  node: Node<M>,
  type: GraphQLNamedType,
  declared: GraphQLNamedType,
  fieldNodes: readonly FieldNode[],
  indirectPath: string[],
  deferred: boolean,
) {
  // Every node selects the same field.
  if (fieldNodes.length === 0 || fieldNodes[0].name.value.startsWith('__')) {
    return;
  }

  const { info, adapter } = walk.env;
  const include = includeOf(type);

  if (include?.paths?.length || include?.path?.length) {
    for (const fieldNode of fieldNodes) {
      const matches = findMatches(info, type, fieldNode, include.paths ?? [include.path!], {
        path: indirectPath,
        deferred,
      });

      for (const match of matches) {
        walkFields(walk, node, match.type, match.type, [match.field], match.path, match.deferred);
      }
    }

    // The wrapper's own selection is planned only when the wrapper itself is backed by the model
    // being queried (a variant that also points at a nested field). A plain wrapper, or one backed
    // by another model, has nothing of its own to add to this query.
    if (adapter.modelFor(type) !== node.model) {
      return;
    }
  } else if (include) {
    walkFields(
      walk,
      node,
      info.schema.getType(include.getType())!,
      declared,
      fieldNodes,
      indirectPath,
      deferred,
    );

    return;
  }

  if (!(isObjectType(type) || isInterfaceType(type))) {
    return;
  }

  enter(walk, node, type);

  if (deferred && walk.env.skipDeferred) {
    return;
  }

  const selectionSets = fieldNodes.flatMap((fieldNode) =>
    fieldNode.selectionSet ? [fieldNode.selectionSet.selections] : [],
  );
  const entered = new Set<string>();

  for (const selections of selectionSets) {
    enterVariants(walk, node, type, declared, selections, entered);
  }

  const walked = new Set<string>();

  for (const selections of selectionSets) {
    walkSelections(walk, node, type, declared, selections, indirectPath, true, walked);
  }
}

type Fragment = FragmentDefinitionNode | InlineFragmentNode;

/**
 * Whether `fragment` was already expanded under `key` in the pass `visited` belongs to, recording
 * it if not. A named fragment spread more than once under the same type does the same work each
 * time, and a valid fragment DAG can spread the same fragment at every level, so expanding every
 * spread is exponential in its depth. Inline fragments cannot repeat.
 */
function expandedBefore(visited: Set<string>, key: string, fragment: Fragment): boolean {
  if (fragment.kind !== Kind.FRAGMENT_DEFINITION) {
    return false;
  }

  const id = `${key}:${fragment.name.value}`;

  if (visited.has(id)) {
    return true;
  }

  visited.add(id);

  return false;
}

/**
 * S-7 first pass: enters every same-model variant a fragment under `selections` moves the walk to,
 * before any field at `node` is merged, so a conflict between two type-level selections is
 * reported whichever order the fragments appear in and never depends on a field-level select.
 */
function enterVariants<M, Map, X>(
  walk: Walk<M, Map, X>,
  node: Node<M>,
  type: WalkedType,
  declared: GraphQLNamedType,
  selections: readonly SelectionNode[],
  visited: Set<string>,
) {
  for (const selection of selections) {
    if (selection.kind === Kind.FIELD) {
      continue;
    }

    const fragment = applicableFragment(walk.env, selection);

    if (!fragment || expandedBefore(visited, type.name, fragment)) {
      continue;
    }

    const as = fragmentTypeOf(walk.env, type, declared, fragment);

    if (as && as !== type) {
      enterVariant(walk, node, type, as);
    }

    enterVariants(walk, node, as ?? type, declared, fragment.selectionSet.selections, visited);
  }
}

/**
 * S-7 second pass: walks `selections` in document order, a fragment's fields where the fragment
 * appears. Fields apply to `node` unless the enclosing fragment cannot apply to `type`; nested
 * fragments are always classified against `type`, so one may narrow back to it.
 */
function walkSelections<M, Map, X>(
  walk: Walk<M, Map, X>,
  node: Node<M>,
  type: WalkedType,
  declared: GraphQLNamedType,
  selections: readonly SelectionNode[],
  indirectPath: string[],
  fieldsApply: boolean,
  visited: Set<string>,
) {
  for (const selection of selections) {
    if (selection.kind === Kind.FIELD) {
      if (fieldsApply) {
        applyField(walk, node, type, selection, indirectPath);
      }

      continue;
    }

    const fragment = applicableFragment(walk.env, selection);

    if (!fragment || expandedBefore(visited, `${type.name}:${fieldsApply}`, fragment)) {
      continue;
    }

    const as = fragmentTypeOf(walk.env, type, declared, fragment);

    walkSelections(
      walk,
      node,
      as ?? type,
      declared,
      fragment.selectionSet.selections,
      indirectPath,
      // An untyped fragment inherits; a typed one applies iff it can apply to `type`.
      fragment.typeCondition ? as !== undefined : fieldsApply,
      visited,
    );
  }
}

/**
 * The fragment a non-field selection stands for, or undefined when it does not apply: skipped by
 * a directive (S-2), or deferred (S-8).
 */
function applicableFragment<M, Map, X>(
  { info, skipDeferred }: Env<M, Map, X>,
  selection: SelectionNode,
): Fragment | undefined {
  if (selection.kind !== Kind.FRAGMENT_SPREAD && selection.kind !== Kind.INLINE_FRAGMENT) {
    throw new PothosValidationError(
      `Unsupported selection kind ${(selection as { kind: string }).kind}`,
    );
  }

  if (isSkipped(info, selection) || (skipDeferred && isDeferred(info, selection))) {
    return undefined;
  }

  return selection.kind === Kind.FRAGMENT_SPREAD ? info.fragments[selection.name.value] : selection;
}

/** The type to walk `fragment` as while walking `type`; an untyped fragment inherits `type`. */
function fragmentTypeOf<M, Map, X>(
  env: Env<M, Map, X>,
  type: WalkedType,
  declared: GraphQLNamedType,
  fragment: Fragment,
): WalkedType | undefined {
  if (!fragment.typeCondition) {
    return type;
  }

  const condition = env.info.schema.getType(fragment.typeCondition.name.value)!;

  return env.adapter.fragmentType
    ? env.adapter.fragmentType(type, condition, declared)
    : defaultFragmentType(env.adapter, type, condition, declared);
}

/** S-2..S-6: merges what `fieldNode` (a field of `type`) selects into `node`. */
function applyField<M, Map, X>(
  walk: Walk<M, Map, X>,
  node: Node<M>,
  type: WalkedType,
  fieldNode: FieldNode,
  indirectPath: string[],
) {
  const { info, context, adapter } = walk.env;
  const name = fieldNode.name.value;

  if (name.startsWith('__') || isSkipped(info, fieldNode)) {
    return;
  }

  const field = type.getFields()[name];

  if (!field) {
    throw new PothosValidationError(`Unknown field ${name} on ${type.name}`);
  }

  const selection = adapter.fieldSelection(field);

  if (!selection) {
    return;
  }

  const alias = fieldNode.alias?.value ?? name;
  const key = `${type.name}@${indirectPath.length > 0 ? `${indirectPath.join('.')}.` : ''}${alias}`;

  if (typeof selection !== 'function') {
    mergeField(walk, node, key, selection, NONE);

    return;
  }

  // This invocation's mapping; every nested walk it makes records into `mapping.nested`, which
  // stays invisible to the walk until the invocation's map is accepted.
  const extra = adapter.callbackExtra?.(walk.extra, type, field, fieldNode);
  const mapping: Mapping = { nested: {}, extra };
  const args = getMappedArgumentValues(field, fieldNode, context, info) as Record<string, unknown>;

  const map = (selection as SelectFn<Map, X>)(
    args,
    context,
    nestedSelectionFor(walk, field, fieldNode, args, extra, mapping),
    getNodeFor(walk, field, fieldNode),
    extra as X,
  );

  mergeField(walk, node, key, map, mapping);
}

/**
 * S-5, M-3, M-4, L-2: merges an accepted map and records its mapping, or does neither. A
 * rejected or falsy map records nothing, so the resolver loads its own data (L-3). This is the
 * only place a mapping is recorded.
 */
function mergeField<M, Map, X>(
  walk: Walk<M, Map, X>,
  node: Node<M>,
  key: string,
  map: Map | false | null | undefined,
  mapping: Mapping,
) {
  if (map && walk.env.adapter.compatible(node, map, true)) {
    walk.env.adapter.merge(node, map);
    walk.mappings[key] = unionMappings(walk.mappings[key], mapping);
  }
}

/** Adopts the first mapping accepted for a key; later accepted walks of the key deep-union. */
function unionMappings(into: Mapping | undefined, from: Mapping): Mapping {
  if (!into || into === NONE) {
    return from;
  }

  for (const key of Object.keys(from.nested)) {
    into.nested[key] = unionMappings(into.nested[key], from.nested[key]);
  }

  return into;
}

/** E-3: the nested selection callback of one select invocation. */
function nestedSelectionFor<M, Map, X>(
  walk: Walk<M, Map, X>,
  field: GraphQLField<unknown, unknown>,
  fieldNode: FieldNode,
  args: object,
  extra: X | undefined,
  mapping: Mapping,
): NestedSelection<Map, X> {
  const { env } = walk;
  const { info, adapter } = env;

  return (rawQuery, pathOrInclude, typeName) => {
    const returnType = getNamedType(field.type);
    const include = Array.isArray(pathOrInclude)
      ? normalizeInclude(
          pathOrInclude,
          resolveType(info.schema, returnType),
          typeName ? info.schema.getType(typeName) : undefined,
        )
      : pathOrInclude;
    const target = include ? info.schema.getType(include.getType())! : returnType;
    const child = createWalk(env, target, mapping.nested, extra);
    // `true` is the public "no query"; it never reaches an adapter.
    const query =
      rawQuery === true
        ? undefined
        : typeof rawQuery === 'function'
          ? (rawQuery as (args: object, ctx: object, extra: X) => Map | null | undefined)(
              args,
              env.context,
              extra as X,
            )
          : rawQuery;

    if (query && hasKeys(query)) {
      adapter.merge(child.root, { ...adapter.empty, ...query });
    }

    const paths = include?.paths?.length
      ? include.paths
      : include?.path?.length
        ? [include.path]
        : undefined;

    if (paths) {
      // Each match is walked as its own type (W-11); the wrapper's selection set is not walked.
      const matches = findMatches(info, returnType, fieldNode, paths, {
        prefix: includeOf(returnType)?.path,
        targetType: target,
        modelOf: env.modelOf,
      });

      for (const match of matches) {
        walkFields(
          child,
          child.root,
          match.type,
          match.type,
          [match.field],
          match.path,
          match.deferred,
        );
      }
    } else {
      if (target !== returnType) {
        walkFields(child, child.root, target, returnType, [fieldNode], [], false);
      }

      walkFields(child, child.root, returnType, returnType, [fieldNode], [], false);
    }

    return finish(child, serializeRoot);
  };
}

/**
 * E-5: the first field node selected at `path` beneath the field, seen through any wrapper on
 * the field's return type (an errors plugin result, for instance), whose own path leads to the
 * type the caller's path starts from. An empty path yields the field node itself, or the
 * wrapper's inner node.
 */
function getNodeFor<M, Map, X>(
  walk: Walk<M, Map, X>,
  field: GraphQLField<unknown, unknown>,
  fieldNode: FieldNode,
) {
  const { info } = walk.env;

  return (path: string[]) => {
    const returnType = getNamedType(field.type);
    const matches = findMatches(info, returnType, fieldNode, [path.map((name) => ({ name }))], {
      prefix: includeOf(returnType)?.path,
    });

    return matches[0]?.field ?? null;
  };
}

function hasKeys(value: object) {
  return Object.keys(value).length > 0;
}
