import {
  getMappedArgumentValues,
  isThenable,
  type MaybePromise,
  PothosValidationError,
} from '@pothos/core';
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

/** A relation query: a map, or a callback building one from the field's arguments. */
export type NestedQuery<Map, X = undefined> =
  | MaybePromise<Map | null | undefined>
  | ((args: object, ctx: object, extra: X) => MaybePromise<Map | null | undefined>);

/**
 * The callback handed to a field's select function to plan the selection beneath the field:
 * `query` is merged first (a function is called with the field's args, `true` means no query),
 * then the selection found under `path` (an explicit include, or a string path from the field's
 * return type) is walked as `type` (or the field's return type). Declared synchronous (A-7): the
 * result is a promise only when a callback beneath it returned one, and must then be awaited.
 */
export type NestedSelection<Map, X = undefined> = (
  query?: NestedQuery<Map, X> | true,
  path?: PathSegment[] | IndirectInclude,
  type?: string,
) => Map;

/** A function field selection (S-6). A falsy result selects nothing (S-5). */
export type SelectFn<Map, X = undefined> = (
  args: object,
  ctx: object,
  nested: NestedSelection<Map, X>,
  getSelectedNode: (path: string[]) => FieldNode | null,
  extra: X,
) => MaybePromise<Map | false | null | undefined>;

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
  /**
   * The merges waiting on a user callback that returned a promise, in the order they were
   * appended (A-2, A-4). Absent until the first one: a synchronous walk never creates a promise.
   */
  pending?: Promise<void>;
}

/** The mapping of a static selection: nothing can ever be recorded beneath one. */
const NONE: Mapping = Object.freeze({ nested: Object.freeze({}) as Mappings });

/**
 * One select invocation's mapping record while the invocation runs: `pending` counts the nested
 * selections it started whose walk is async and which have not resolved (A-8). Set only when a
 * nested walk is async, and removed once every one has resolved, so a recorded `Mapping` never
 * carries it and a synchronous invocation never touches it.
 */
interface Invocation extends Mapping {
  pending?: number;
}

function noop() {}

/**
 * A-3, M-2: a walk that threw synchronously never reaches `finish`, so the merges it had already
 * chained would reject unobserved once their callbacks settle. The throw is what the caller sees.
 */
function abandon<M, Map, X>(walk: Walk<M, Map, X>) {
  walk.pending?.catch(noop);
}

/**
 * E-1: the query for the field `info` resolves, with its loader mappings recorded (L-2).
 * Declared synchronous (A-7): a promise is returned only when a callback returned one.
 */
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

/**
 * E-1 without emitting: the walk itself, nothing recorded, or undefined when paths are given and
 * nothing is selected under them. Declared synchronous like `queryFromInfo` (A-7). A plugin that
 * must hand a resolver a synchronous query builder settles this first, then emits the query with
 * `queryFromWalk` once the resolver asks for it.
 */
export function walkFromInfo<M, Map extends object, X = undefined>(
  adapter: Adapter<M, Map, X>,
  options: EntryOptions<Map>,
): Walk<M, Map, X> | undefined {
  const walk = buildWalk(makeEnv(adapter, options), options);

  return walk && finish(walk, identity);
}

/**
 * E-1 from a settled walk: the loader mappings recorded (L-2) and the query serialized (M-6,
 * L-5). Synchronous: the walk must be one `walkFromInfo` returned, and when that was a promise,
 * the walk it resolved to. `select` takes the place of `initial`: the query is built from it first
 * and the walked plan merged over it, so a compatible `select` yields what `queryFromInfo` yields
 * with it as `initial`. The caller checks compatibility (`typeLevelConflict`) first: a relation or
 * extra the plan already holds with other arguments cannot be merged after the fact.
 */
export function queryFromWalk<M, Map extends object, X = undefined>(
  walk: Walk<M, Map, X>,
  select?: Map,
  withUsageCheck?: boolean,
): Map {
  const { adapter, context, info } = walk.env;

  setLoaderMappings(context, info, walk.mappings);

  if (!select) {
    return wrap(adapter.serialize(walk.root), withUsageCheck);
  }

  const root = createNode(walk.root.model);

  adapter.merge(root, select);
  adapter.merge(root, adapter.serialize(walk.root));

  return wrap(adapter.serialize(root), withUsageCheck);
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

  try {
    // Every node selecting the field (one per fragment it appears under) plans into the same
    // row, so the loaded row satisfies each of them.
    for (const fieldNode of info.fieldNodes) {
      applyField(walk, walk.root, type, fieldNode, []);
    }
  } catch (error) {
    abandon(walk);
    throw error;
  }

  return finish(walk, enterLoaded, type);
}

/** E-2: the parent type's selection, minus what conflicts with the field, once it is merged. */
function enterLoaded<M, Map, X>(walk: Walk<M, Map, X>, type: GraphQLNamedType) {
  const { adapter } = walk.env;
  const selection = adapter.typeSelection(type);

  if (selection) {
    adapter.merge(walk.root, adapter.withoutConflicts(walk.root, selection));
  }

  return walk;
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

/**
 * A-2: appends the merge of `value` to the walk's pending chain. Only merges are chained, never
 * user code, so a link can never append another and the chain needs no loop. Each link waits on
 * the previous one, so async merges run in the order they were appended (A-4). Both promises get
 * a handler at once, so a callback that rejects early is never an unhandled rejection.
 */
function chain<M, Map, X, T>(walk: Walk<M, Map, X>, value: PromiseLike<T>, merge: (v: T) => void) {
  const prev = walk.pending;

  walk.pending = prev
    ? Promise.all([prev, value]).then(([, v]) => merge(v))
    : Promise.resolve(value).then(merge);
}

/**
 * The single exit of every entry point (A-3): `done` runs now when nothing is pending, else
 * after every pending merge. The result is then a promise behind the declared synchronous type
 * (A-7): a schema without async callbacks never sees one, and one with them must await it.
 * Fixed arity, so the synchronous call allocates nothing.
 */
function finish<M, Map, X, R>(walk: Walk<M, Map, X>, done: (walk: Walk<M, Map, X>) => R): R;
function finish<M, Map, X, A, R>(
  walk: Walk<M, Map, X>,
  done: (walk: Walk<M, Map, X>, arg: A) => R,
  arg: A,
): R;
function finish<M, Map, X, A, R>(
  walk: Walk<M, Map, X>,
  done: (walk: Walk<M, Map, X>, arg?: A) => R,
  arg?: A,
): R {
  return walk.pending ? (walk.pending.then(() => done(walk, arg)) as R) : done(walk, arg);
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

    try {
      // Every match is planned into the one root, entered under its own type first (W-11).
      walkFieldWalks(
        walk,
        walk.root,
        matches.map((match) => ({
          // A matched type with its own model (including variants of the target model) is walked
          // with its own model. Types without a model (interfaces, wrappers) are walked as the
          // requested type so its fields can be found.
          type: typeName && !env.modelOf(match.type) ? target : match.type,
          declared: match.type,
          fieldNodes: [match.field],
          indirectPath: match.path,
          deferred: match.deferred,
        })),
      );
    } catch (error) {
      abandon(walk);
      throw error;
    }

    return walk;
  }

  const walk = createWalk(env, target, {}, extra, initial);

  try {
    walkFields(walk, walk.root, target, returnType, info.fieldNodes, [], false);
  } catch (error) {
    abandon(walk);
    throw error;
  }

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
 * One selection to walk into a node: the selection sets of `fieldNodes` (every node selecting one
 * field), walked as `type`. `declared` is the field's declared return type, which decides how
 * fragments are classified.
 */
interface FieldWalk {
  type: GraphQLNamedType;
  declared: GraphQLNamedType;
  fieldNodes: readonly FieldNode[];
  indirectPath: string[];
  deferred: boolean;
}

/** A `FieldWalk` resolved through any indirect include to the type whose fields are walked. */
interface ResolvedFieldWalk {
  type: WalkedType;
  declared: GraphQLNamedType;
  selectionSets: (readonly SelectionNode[])[];
  indirectPath: string[];
}

/** E-4, S-1, S-8: `walkFieldWalks` for one selection. */
function walkFields<M, Map, X>(
  walk: Walk<M, Map, X>,
  node: Node<M>,
  type: GraphQLNamedType,
  declared: GraphQLNamedType,
  fieldNodes: readonly FieldNode[],
  indirectPath: string[],
  deferred: boolean,
) {
  walkFieldWalks(walk, node, [{ type, declared, fieldNodes, indirectPath, deferred }]);
}

/**
 * E-4, S-1, S-8: walks every selection of `walks` into `node`. The types the selections are
 * walked as, and the variants their fragments move to, are all entered before any field is
 * merged, so type-level selections are settled first and the plan does not depend on which
 * selection comes first: neither the occurrence of a field (W-1) nor the path match (W-11).
 */
function walkFieldWalks<M, Map, X>(walk: Walk<M, Map, X>, node: Node<M>, walks: FieldWalk[]) {
  const resolved = walks.flatMap((fieldWalk) => resolveFieldWalk(walk, node, fieldWalk));

  for (const { type, declared, selectionSets } of resolved) {
    enter(walk, node, type);

    const entered = new Set<string>();

    for (const selections of selectionSets) {
      enterVariants(walk, node, type, declared, selections, entered);
    }
  }

  for (const { type, declared, selectionSets, indirectPath } of resolved) {
    const walked = new Set<string>();

    for (const selections of selectionSets) {
      walkSelections(walk, node, type, declared, selections, indirectPath, true, walked);
    }
  }
}

/**
 * E-4: the selections `fieldWalk` stands for once its type's indirect include is followed, in the
 * order they are walked. A type-level path yields one per match beneath the wrapper; a plain
 * include re-types the walk; anything but an object or interface type yields nothing.
 */
function resolveFieldWalk<M, Map, X>(
  walk: Walk<M, Map, X>,
  node: Node<M>,
  { type, declared, fieldNodes, indirectPath, deferred }: FieldWalk,
): ResolvedFieldWalk[] {
  // Every node selects the same field.
  if (fieldNodes.length === 0 || fieldNodes[0].name.value.startsWith('__')) {
    return [];
  }

  const { info, adapter } = walk.env;
  const include = includeOf(type);
  const beneath: ResolvedFieldWalk[] = [];

  if (include?.paths?.length || include?.path?.length) {
    for (const fieldNode of fieldNodes) {
      const matches = findMatches(info, type, fieldNode, include.paths ?? [include.path!], {
        path: indirectPath,
        deferred,
      });

      for (const match of matches) {
        beneath.push(
          ...resolveFieldWalk(walk, node, {
            type: match.type,
            declared: match.type,
            fieldNodes: [match.field],
            indirectPath: match.path,
            deferred: match.deferred,
          }),
        );
      }
    }

    // The wrapper's own selection is planned only when the wrapper itself is backed by the model
    // being queried (a variant that also points at a nested field). A plain wrapper, or one backed
    // by another model, has nothing of its own to add to this query.
    if (adapter.modelFor(type) !== node.model) {
      return beneath;
    }
  } else if (include) {
    return resolveFieldWalk(walk, node, {
      type: info.schema.getType(include.getType())!,
      declared,
      fieldNodes,
      indirectPath,
      deferred,
    });
  }

  if (!(isObjectType(type) || isInterfaceType(type))) {
    return beneath;
  }

  // A deferred selection is entered but, when deferred fragments are skipped, not walked.
  const selectionSets =
    deferred && walk.env.skipDeferred
      ? []
      : fieldNodes.flatMap((fieldNode) =>
          fieldNode.selectionSet ? [fieldNode.selectionSet.selections] : [],
        );

  return [...beneath, { type, declared, selectionSets, indirectPath }];
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
  const mapping: Invocation = { nested: {}, extra };
  const args = getMappedArgumentValues(field, fieldNode, context, info);
  const select = selection as SelectFn<Map, X>;

  // S-6: the select runs as soon as its own arguments are known; only its merge waits (A-3).
  const map = isThenable(args)
    ? args.then((mapped) => runSelect(walk, field, fieldNode, select, mapped, extra, mapping))
    : runSelect(walk, field, fieldNode, select, args, extra, mapping);

  if (isThenable(map)) {
    chain(walk, map as PromiseLike<Map | false | null | undefined>, (resolved) =>
      mergeField(walk, node, key, resolved, mapping),
    );
  } else {
    mergeField(walk, node, key, map, mapping);
  }
}

function runSelect<M, Map, X>(
  walk: Walk<M, Map, X>,
  field: GraphQLField<unknown, unknown>,
  fieldNode: FieldNode,
  select: SelectFn<Map, X>,
  args: object,
  extra: X | undefined,
  mapping: Mapping,
) {
  return select(
    args,
    walk.env.context,
    nestedSelectionFor(walk, field, fieldNode, args, extra, mapping),
    getNodeFor(walk, field, fieldNode),
    extra as X,
  );
}

/**
 * S-5, M-3, M-4, L-2: merges an accepted map and records its mapping, or does neither. A
 * rejected or falsy map records nothing, so the resolver loads its own data (L-3). This is the
 * only place a mapping is recorded.
 *
 * A-8: an invocation whose nested selection is still pending returned without awaiting it. Its
 * map cannot hold what the nested walk will select, so recording its mapping would claim data
 * the query never loads: the invocation is refused instead, and the pending walks (already
 * handled, see `awaitNested`) are left to settle unobserved. Checked after the merge, so a map
 * that embeds the pending promise is reported as that by the adapter.
 */
function mergeField<M, Map, X>(
  walk: Walk<M, Map, X>,
  node: Node<M>,
  key: string,
  map: Map | false | null | undefined,
  mapping: Invocation,
) {
  if (!(map && walk.env.adapter.compatible(node, map, true))) {
    return;
  }

  walk.env.adapter.merge(node, map);

  if (mapping.pending) {
    throw new PothosValidationError(
      `The selection function of ${key.replace('@', '.')} returned while a nested selection it started was still pending. Await nestedSelection() (or a helper built on it, such as getQuery) inside an async selection function.`,
    );
  }

  walk.mappings[key] = unionMappings(walk.mappings[key], mapping);
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
  mapping: Invocation,
): NestedSelection<Map, X> {
  const { env } = walk;
  const { info } = env;

  return (rawQuery, pathOrInclude, typeName) => {
    const returnType = getNamedType(field.type);
    const include = Array.isArray(pathOrInclude)
      ? normalizeInclude(
          pathOrInclude,
          resolveType(info.schema, returnType),
          typeName ? info.schema.getType(typeName) : undefined,
          info.schema,
        )
      : pathOrInclude;
    const target = include ? info.schema.getType(include.getType())! : returnType;
    const child = createWalk(env, target, mapping.nested, extra);

    try {
      // `true` is the public "no query"; it never reaches an adapter.
      const query: MaybePromise<Map | null | undefined> =
        rawQuery === true
          ? undefined
          : typeof rawQuery === 'function'
            ? (
                rawQuery as (
                  args: object,
                  ctx: object,
                  extra: X,
                ) => MaybePromise<Map | null | undefined>
              )(args, env.context, extra as X)
            : rawQuery;

      if (isThenable(query)) {
        chain(child, query as PromiseLike<Map | null | undefined>, (resolved) =>
          mergeQuery(child, resolved),
        );
      } else {
        mergeQuery(child, query);
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

        walkFieldWalks(
          child,
          child.root,
          matches.map((match) => ({
            type: match.type,
            declared: match.type,
            fieldNodes: [match.field],
            indirectPath: match.path,
            deferred: match.deferred,
          })),
        );
      } else {
        const asType = (type: GraphQLNamedType): FieldWalk => ({
          type,
          declared: returnType,
          fieldNodes: [fieldNode],
          indirectPath: [],
          deferred: false,
        });

        walkFieldWalks(child, child.root, [
          ...(target === returnType ? [] : [asType(target)]),
          asType(returnType),
        ]);
      }
    } catch (error) {
      abandon(child);
      throw error;
    }

    // A promise behind the declared synchronous type, as `finish` returns one (A-7).
    return child.pending ? (awaitNested(child, mapping) as Map) : serializeRoot(child);
  };
}

/**
 * A-8: the promise of a nested selection whose walk is async, counted against its invocation
 * until it resolves. It is handled here, so a nested selection the invocation discards is never
 * an unhandled rejection: `mergeField` refuses the invocation instead. A rejection keeps the
 * count, since the invocation did not wait for it either; one that was awaited surfaces through
 * the invocation's own promise.
 */
function awaitNested<M, Map, X>(child: Walk<M, Map, X>, mapping: Invocation) {
  mapping.pending = (mapping.pending ?? 0) + 1;

  const result = child.pending!.then(() => serializeRoot(child));

  result.then(() => {
    if (mapping.pending === 1) {
      delete mapping.pending;
    } else {
      mapping.pending! -= 1;
    }
  }, noop);

  return result;
}

/** E-3: a relation query merges over `empty`, so a query without columns adds none. */
function mergeQuery<M, Map, X>(child: Walk<M, Map, X>, query: Map | null | undefined) {
  if (query && hasKeys(query)) {
    child.env.adapter.merge(child.root, { ...child.env.adapter.empty, ...query });
  }
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
