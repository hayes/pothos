/**
 * The entry points: E-1 (`queryFromInfo`, `walkFromInfo`, `queryFromWalk`) and E-2
 * (`selectionStateFromInfo`).
 */
import { isThenable, PothosValidationError } from '@pothos/core';
import { type GraphQLResolveInfo, getNamedType } from 'graphql';
import { abandon, finish } from './async.js';
import { type Mappings, setLoaderMappings } from './loader-map.js';
import {
  findMatches,
  type IndirectPathSegment,
  includeOf,
  type PathSegment,
  resolveType,
} from './matches.js';
import type { Node, NodeBase } from './node.js';
import type { Adapter, EntryOptions, Env, Walk } from './types.js';
import {
  applyField,
  createWalk,
  enterLoaded,
  mergeVariant,
  unionMappings,
  walkFields,
  walkFieldWalks,
} from './walk.js';

/**
 * E-1: the query for the field `info` resolves, with its loader mappings recorded (L-2).
 * Declared synchronous (A-7): a promise is returned only when a callback returned one.
 */
export function queryFromInfo<M, Map, X = undefined, N extends NodeBase<M> = Node<M>>(
  adapter: Adapter<M, Map, X, N>,
  options: EntryOptions<Map>,
): Map {
  const walk = walkFromInfo(adapter, options);

  if (!walk) {
    // Nothing is selected under the paths: there is nothing to plan and nothing to map, so the
    // caller gets back its own selection.
    return options.initial ?? ({} as Map);
  }

  return isThenable(walk)
    ? (walk.then((settled) => queryFromWalk(settled as Walk<M, Map, X, N>)) as unknown as Map)
    : queryFromWalk(walk);
}

/**
 * E-1 without emitting: the walk itself, nothing recorded, or undefined when paths are given and
 * nothing is selected under them. Declared synchronous like `queryFromInfo` (A-7). A plugin that
 * must hand a resolver a synchronous query builder settles this first, then emits the query with
 * `queryFromWalk` once the resolver asks for it.
 */
export function walkFromInfo<M, Map, X = undefined, N extends NodeBase<M> = Node<M>>(
  adapter: Adapter<M, Map, X, N>,
  options: EntryOptions<Map>,
): Walk<M, Map, X, N> | undefined {
  const walk = buildWalk(makeEnv(adapter, options), options);

  return walk && finish(walk, identity);
}

/**
 * E-1 from a settled walk: the loader mappings recorded (L-2) and the query serialized (M-6,
 * L-5). Synchronous: the walk must be one `walkFromInfo` returned, and when that was a promise,
 * the walk it resolved to. `select` takes the place of `initial`: it comes first, so a relation
 * or extra the walked plan holds with other arguments loses (M-4) and its field loads on its own.
 * When `select` conflicts with nothing, merging it under the settled plan gives that same query;
 * otherwise the plan is replayed from the merges a replayable walk recorded, which runs no user
 * callback again, so it is synchronous whether or not the plan was async.
 */
export function queryFromWalk<M, Map, X = undefined, N extends NodeBase<M> = Node<M>>(
  walk: Walk<M, Map, X, N>,
  select?: Map,
): Map {
  const { adapter, info } = walk.env;

  if (!select) {
    recordMappings(walk, walk.mappings);

    return adapter.serialize(walk.root);
  }

  const root = adapter.createNode(walk.root.model);

  adapter.merge(root, select);

  if (!adapter.typeLevelConflict(walk.root, select)) {
    adapter.merge(root, adapter.serialize(walk.root));
    recordMappings(walk, walk.mappings);

    return adapter.serialize(root);
  }

  if (!walk.merges) {
    throw new PothosValidationError(
      `The selection passed to query() in the resolver for ${info.parentType.name}.${info.fieldName} conflicts with a selection beneath the field, and the walk was not built with replayable: true.`,
    );
  }

  const mappings: Mappings = {};

  for (const merge of walk.merges) {
    if (merge.kind === 'type') {
      adapter.merge(root, merge.map);
    } else if (merge.kind === 'variant') {
      mergeVariant(adapter, root, merge.type, merge.variant, merge.map);
    } else if (adapter.compatible(root, merge.map, true, merge.key, merge.alias)) {
      adapter.merge(root, merge.map, merge.key, merge.alias);

      if (adapter.recordsMappings !== false) {
        mappings[merge.key] = unionMappings(mappings[merge.key], merge.mapping);
      }
    }
  }

  recordMappings(walk, mappings);

  return adapter.serialize(root);
}

/**
 * L-2: records the walk's mappings for the resolvers beneath it, unless the adapter records none,
 * in which case the context is not touched either (an adapter that reads rows its own way may
 * run with a context that is not an object).
 */
function recordMappings<M, Map, X, N extends NodeBase<M>>(
  walk: Walk<M, Map, X, N>,
  mappings: Mappings,
) {
  if (walk.env.adapter.recordsMappings !== false) {
    setLoaderMappings(walk.env.context, walk.env.info, mappings);
  }
}

/**
 * E-2: the walk loading the field `info` resolves for its parent row. The loaded row replaces the
 * parent the field resolver sees, so besides the field's own selection it carries the parent
 * type's type-level selection. The field is what the row is loaded for, so it is merged first
 * and a type-level relation whose arguments conflict with it is left out.
 */
export function selectionStateFromInfo<M, Map, X = undefined, N extends NodeBase<M> = Node<M>>(
  adapter: Adapter<M, Map, X, N>,
  context: object,
  info: GraphQLResolveInfo,
  skipDeferredFragments?: boolean,
): Walk<M, Map, X, N> {
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

function identity<M, Map, X, N extends NodeBase<M>>(walk: Walk<M, Map, X, N>) {
  return walk;
}

function makeEnv<M, Map, X, N extends NodeBase<M>>(
  adapter: Adapter<M, Map, X, N>,
  {
    context,
    info,
    skipDeferredFragments,
  }: Pick<EntryOptions<Map>, 'context' | 'info'> & {
    skipDeferredFragments?: boolean;
  },
): Env<M, Map, X, N> {
  return {
    adapter,
    context,
    info,
    skipDeferred: skipDeferredFragments ?? adapter.skipDeferredFragments,
    modelOf: (type) => adapter.modelFor(resolveType(info.schema, type)),
  };
}

/** E-1: undefined when paths are given and nothing is selected under them. */
function buildWalk<M, Map, X, N extends NodeBase<M>>(
  env: Env<M, Map, X, N>,
  { typeName, path, paths, initial, replayable }: EntryOptions<Map>,
): Walk<M, Map, X, N> | undefined {
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

    const walk = createWalk(
      env,
      typeName ? target : matches[0].type,
      {},
      extra,
      initial,
      replayable,
    );

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

  const walk = createWalk(env, target, {}, extra, initial, replayable);

  try {
    walkFields(walk, walk.root, target, info.fieldNodes, [], false);
  } catch (error) {
    abandon(walk);
    throw error;
  }

  return walk;
}

/** D-7: the extra for the resolved field itself, which starts the extras of the fields beneath. */
function rootExtra<M, Map, X, N extends NodeBase<M>>({
  adapter,
  info,
}: Env<M, Map, X, N>): X | undefined {
  if (!adapter.callbackExtra) {
    return undefined;
  }

  const node = info.fieldNodes[0];
  const field = info.parentType.getFields()[node.name.value];

  return field ? adapter.callbackExtra(undefined, info.parentType, field, node) : undefined;
}

function normalizePaths(paths: PathSegment[][]): IndirectPathSegment[][] {
  return paths.map((path) =>
    path.map((segment) => (typeof segment === 'string' ? { name: segment } : segment)),
  );
}
