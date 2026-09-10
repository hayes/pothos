/**
 * The entry points: E-1 (`queryFromInfo`, `walkFromInfo`, `queryFromWalk`) and E-2
 * (`selectionStateFromInfo`).
 */
import { PothosValidationError } from '@pothos/core';
import { type GraphQLResolveInfo, getNamedType } from 'graphql';
import { abandon, finish } from './async.js';
import { type Mappings, setLoaderMappings } from './loader-map.js';
import {
  findMatches,
  type IndirectPathSegment,
  includeOf,
  matchesForModel,
  modelOf,
  type PathSegment,
} from './matches.js';
import type { Node, NodeBase } from './node.js';
import type { Adapter, EntryOptions, Position, RootMerge, Walk } from './types.js';
import {
  applyField,
  createWalk,
  enterLoaded,
  mergeVariant,
  unionMappings,
  walkFieldWalks,
} from './walk.js';

/**
 * E-1: the query for the field `info` resolves, with its loader mappings recorded (L-2).
 * Declared synchronous (A-7): a promise is returned only when a callback returned one.
 */
export function queryFromInfo<M, Map, N extends NodeBase<M> = Node<M>>(
  adapter: Adapter<M, Map, N>,
  options: EntryOptions<Map>,
): Map {
  // Emitted here and now, so the merges a replay would need are never recorded.
  const walk = buildWalk(adapter, options, false);

  if (!walk) {
    // Nothing is selected under the paths: there is nothing to plan and nothing to map, so the
    // caller gets back its own selection.
    return options.initial ?? ({} as Map);
  }

  return finish(walk, emit);
}

/**
 * E-1 without emitting: the walk itself, nothing recorded, or undefined when paths are given and
 * nothing is selected under them. Declared synchronous like `queryFromInfo` (A-7). A plugin that
 * must hand a resolver a synchronous query builder settles this first, then emits the query with
 * `queryFromWalk` once the resolver asks for it. The walk records its merges into the root, which
 * is what lets `queryFromWalk` put the resolver's own selection first.
 */
export function walkFromInfo<M, Map, N extends NodeBase<M> = Node<M>>(
  adapter: Adapter<M, Map, N>,
  options: EntryOptions<Map>,
): Walk<M, Map, N> | undefined {
  const walk = buildWalk(adapter, options, true);

  return walk && finish(walk, identity);
}

/**
 * E-1 from a settled walk: the loader mappings recorded (L-2) and the query serialized (M-6,
 * L-5). Synchronous: the walk must be one `walkFromInfo` returned, and when that was a promise,
 * the walk it resolved to. `select` takes the place of `initial`: it comes first, so a relation
 * or extra the walked plan holds with other arguments loses (M-4) and its field loads on its own.
 * When `select` conflicts with nothing, merging it under the settled plan gives that same query;
 * otherwise the plan is replayed from the merges the walk recorded, which runs no user callback
 * again, so it is synchronous whether or not the plan was async.
 */
export function queryFromWalk<M, Map, N extends NodeBase<M> = Node<M>>(
  walk: Walk<M, Map, N>,
  select?: Map,
): Map {
  const { adapter } = walk;

  if (!select) {
    return emit(walk);
  }

  const root = adapter.createNode(walk.root.model);

  adapter.merge(root, select);

  if (!adapter.typeLevelConflict(walk.root, select)) {
    adapter.merge(root, adapter.serialize(walk.root));
    setLoaderMappings(walk.context, walk.info, walk.mappings);

    return adapter.serialize(root);
  }

  const mappings: Mappings = {};

  // Only `walkFromInfo` records merges, and only its walks are emitted through here.
  for (const merge of walk.merges!) {
    switch (merge.kind) {
      case 'type':
        adapter.merge(root, merge.map);
        break;
      case 'variant':
        mergeVariant(adapter, root, merge.type, merge.variant, merge.map);
        break;
      case 'field':
        // M-3, M-4: a field's selection is merged, and its mapping recorded, only while it still
        // fits the root the caller's selection went into first; otherwise the field is skipped
        // here and its resolver loads its own data (L-3).
        if (adapter.compatible(root, merge.map, true, merge.key, merge.alias)) {
          adapter.merge(root, merge.map, merge.key, merge.alias);
          mappings[merge.key] = unionMappings(mappings[merge.key], merge.mapping);
        }
        break;
      default: {
        const unknown: never = merge;

        throw new PothosValidationError(
          `Unknown root merge ${String((unknown as RootMerge<Map>).kind)}`,
        );
      }
    }
  }

  setLoaderMappings(walk.context, walk.info, mappings);

  return adapter.serialize(root);
}

/**
 * E-2: the walk loading the field `info` resolves for its parent row. The loaded row replaces the
 * parent the field resolver sees, so besides the field's own selection it carries the parent
 * type's type-level selection. The field is what the row is loaded for, so it is merged first
 * and a type-level relation whose arguments conflict with it is left out.
 */
export function selectionStateFromInfo<M, Map, N extends NodeBase<M> = Node<M>>(
  adapter: Adapter<M, Map, N>,
  context: object,
  info: GraphQLResolveInfo,
  skipDeferredFragments?: boolean,
): Walk<M, Map, N> {
  const type = info.parentType;
  const walk = createWalk(adapter, { context, info, skipDeferredFragments }, type);

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

/** L-2, M-6: the walk's mappings recorded for the resolvers beneath it, and its query serialized. */
function emit<M, Map, N extends NodeBase<M>>(walk: Walk<M, Map, N>): Map {
  setLoaderMappings(walk.context, walk.info, walk.mappings);

  return walk.adapter.serialize(walk.root);
}

/** `finish` needs something to run once the walk has settled; `walkFromInfo` wants the walk. */
function identity<M, Map, N extends NodeBase<M>>(walk: Walk<M, Map, N>) {
  return walk;
}

/** E-1: undefined when paths are given and nothing is selected under them. */
function buildWalk<M, Map, N extends NodeBase<M>>(
  adapter: Adapter<M, Map, N>,
  options: EntryOptions<Map>,
  replayable: boolean,
): Walk<M, Map, N> | undefined {
  const { info, typeName, path, paths } = options;
  const returnType = getNamedType(info.returnType);
  const target = typeName ? info.schema.getType(typeName)! : returnType;
  const position = positionForResolvedField(info);

  // graphql merges every occurrence of the field's response key into `info.fieldNodes`; each is
  // planned into the one root, so the query answers whichever occurrence a resolver runs for.
  if (paths?.length || path?.length) {
    const includePaths = normalizePaths(paths?.length ? paths : [path!]);
    const prefix = includeOf(returnType)?.path;
    const matches = matchesForModel(
      adapter,
      info.schema,
      info.fieldNodes.flatMap((fieldNode) =>
        findMatches(info, returnType, fieldNode, includePaths, { prefix }),
      ),
      target,
    );

    if (matches.length === 0) {
      return undefined;
    }

    const walk = createWalk(
      adapter,
      options,
      typeName ? target : matches[0].type,
      position,
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
          type: typeName && !modelOf(adapter, info.schema, match.type) ? target : match.type,
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

  const walk = createWalk(adapter, options, target, position, replayable);

  try {
    walkFieldWalks(walk, walk.root, [
      { type: target, fieldNodes: info.fieldNodes, indirectPath: [], deferred: false },
    ]);
  } catch (error) {
    abandon(walk);
    throw error;
  }

  return walk;
}

/**
 * D-7: where the field being resolved is, which every position beneath it links back to, so a
 * select function can tell where in the query its field sits. Undefined when `info` does not name
 * the field it resolves (a caller building one by hand): the walk then starts at its own fields.
 */
function positionForResolvedField(info: GraphQLResolveInfo): Position | undefined {
  const node = info.fieldNodes[0];
  const field = info.parentType?.getFields()[node.name.value];

  return field && { parent: undefined, type: info.parentType, field, node };
}

function normalizePaths(paths: PathSegment[][]): IndirectPathSegment[][] {
  return paths.map((path) =>
    path.map((segment) => (typeof segment === 'string' ? { name: segment } : segment)),
  );
}
