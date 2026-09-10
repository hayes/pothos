/**
 * The entry points: E-1 (`queryFromInfo`, `planFromInfo`, `queryFromPlan`) and E-2
 * (`rowPlanFromInfo`).
 */
import { PothosValidationError } from '@pothos/core';
import { type GraphQLResolveInfo, getNamedType } from 'graphql';
import { absorb, accepts, accumulatorOf, conflictOf } from './accumulate.js';
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
import type { Adapter, EntryOptions, Plan, Position, RootMerge } from './types.js';
import {
  createPlan,
  enterParentType,
  mergeVariant,
  unionMappings,
  walkBranches,
  walkField,
} from './walk.js';

/**
 * E-1: the query for the field `info` resolves, with its loader mappings recorded (L-2).
 * Declared synchronous (A-7): a promise is returned only when a callback returned one.
 */
export function queryFromInfo<Model, Query, NodeType extends NodeBase<Model> = Node<Model>>(
  adapter: Adapter<Model, Query, NodeType>,
  options: EntryOptions<Query>,
): Query {
  // Emitted here and now, so the merges a replay would need are never recorded.
  const plan = buildWalk(adapter, options, false);

  if (!plan) {
    // Nothing is selected under the paths: there is nothing to plan and nothing to map, so the
    // caller gets back its own selection.
    return options.initial ?? ({} as Query);
  }

  return finish(plan, emit);
}

/**
 * E-1 without emitting: the plan itself, nothing recorded, or undefined when paths are given and
 * nothing is selected under them. Declared synchronous like `queryFromInfo` (A-7). A plugin that
 * must hand a resolver a synchronous query builder settles this first, then emits the query with
 * `queryFromPlan` once the resolver asks for it. The plan records its merges into the root, which
 * is what lets `queryFromPlan` put the resolver's own selection first.
 */
export function planFromInfo<Model, Query, NodeType extends NodeBase<Model> = Node<Model>>(
  adapter: Adapter<Model, Query, NodeType>,
  options: EntryOptions<Query>,
): Plan<Model, Query, NodeType> | undefined {
  const plan = buildWalk(adapter, options, true);

  return plan && finish(plan, identity);
}

/**
 * E-1 from a settled plan: the loader mappings recorded (L-2) and the query serialized (M-6,
 * L-5). Synchronous: the plan must be one `planFromInfo` returned, and when that was a promise,
 * the plan it resolved to. `select` takes the place of `initial`: it comes first, so a relation
 * or extra the walked plan holds with other arguments loses (M-4) and its field loads on its own.
 * When `select` conflicts with nothing, merging it under the settled plan gives that same query;
 * otherwise the plan is replayed from the merges the plan recorded, which runs no user callback
 * again, so it is synchronous whether or not the plan was async.
 */
export function queryFromPlan<Model, Query, NodeType extends NodeBase<Model> = Node<Model>>(
  plan: Plan<Model, Query, NodeType>,
  select?: Query,
): Query {
  const { adapter } = plan;
  const accumulator = accumulatorOf(adapter);

  if (!select) {
    return emit(plan);
  }

  const root = accumulator.create(plan.root.model);

  accumulator.merge(root, select);

  if (!conflictOf(accumulator, plan.root, select)) {
    // Node to node: the walked plan is merged as it stands, never serialized to be re-read.
    absorb(accumulator, root, plan.root);
    setLoaderMappings(plan.context, plan.info, plan.mappings);

    return accumulator.emit(root);
  }

  const mappings: Mappings = {};

  // Only `planFromInfo` records merges, and only its plans are emitted through here.
  for (const merge of plan.merges!) {
    switch (merge.kind) {
      case 'type':
        accumulator.merge(root, merge.query);
        break;
      case 'variant':
        mergeVariant(adapter, root, merge.type, merge.variant, merge.query);
        break;
      case 'field':
        // M-3, M-4: a field's selection is merged, and its mapping recorded, only while it still
        // fits the root the caller's selection went into first; otherwise the field is skipped
        // here and its resolver loads its own data (L-3).
        if (
          accepts(accumulator, root, merge.query, {
            ignoreArgs: true,
            key: merge.key,
            alias: merge.alias,
          })
        ) {
          accumulator.merge(root, merge.query, { key: merge.key, alias: merge.alias });
          mappings[merge.key] = unionMappings(mappings[merge.key], merge.mapping);
        }
        break;
      default: {
        const unknown: never = merge;

        throw new PothosValidationError(
          `Unknown root merge ${String((unknown as RootMerge<Query>).kind)}`,
        );
      }
    }
  }

  setLoaderMappings(plan.context, plan.info, mappings);

  return accumulator.emit(root);
}

/**
 * E-2: the plan loading the field `info` resolves for its parent row. The loaded row replaces the
 * parent the field resolver sees, so besides the field's own selection it carries the parent
 * type's type-level selection. The field is what the row is loaded for, so it is merged first
 * and a type-level relation whose arguments conflict with it is left out.
 */
export function rowPlanFromInfo<Model, Query, NodeType extends NodeBase<Model> = Node<Model>>(
  adapter: Adapter<Model, Query, NodeType>,
  context: object,
  info: GraphQLResolveInfo,
  skipDeferredFragments?: boolean,
): Plan<Model, Query, NodeType> {
  const type = info.parentType;
  const plan = createPlan(adapter, { context, info, skipDeferredFragments }, type);

  try {
    // Every node selecting the field (one per fragment it appears under) plans into the same
    // row, so the loaded row satisfies each of them.
    for (const fieldNode of info.fieldNodes) {
      walkField(plan, plan.root, type, fieldNode, []);
    }
  } catch (error) {
    abandon(plan);
    throw error;
  }

  return finish(plan, enterParentType, type);
}

/** L-2, M-6: the plan's mappings recorded for the resolvers beneath it, and its query serialized. */
function emit<Model, Query, NodeType extends NodeBase<Model>>(
  plan: Plan<Model, Query, NodeType>,
): Query {
  setLoaderMappings(plan.context, plan.info, plan.mappings);

  return accumulatorOf(plan.adapter).emit(plan.root);
}

/** `finish` needs something to run once the plan has settled; `planFromInfo` wants the plan. */
function identity<Model, Query, NodeType extends NodeBase<Model>>(
  plan: Plan<Model, Query, NodeType>,
) {
  return plan;
}

/** E-1: undefined when paths are given and nothing is selected under them. */
function buildWalk<Model, Query, NodeType extends NodeBase<Model>>(
  adapter: Adapter<Model, Query, NodeType>,
  options: EntryOptions<Query>,
  replayable: boolean,
): Plan<Model, Query, NodeType> | undefined {
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

    const plan = createPlan(
      adapter,
      options,
      typeName ? target : matches[0].type,
      position,
      replayable,
    );

    try {
      // Every match is planned into the one root, entered under its own type first (W-11).
      walkBranches(
        plan,
        plan.root,
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
      abandon(plan);
      throw error;
    }

    return plan;
  }

  const plan = createPlan(adapter, options, target, position, replayable);

  try {
    walkBranches(plan, plan.root, [
      { type: target, fieldNodes: info.fieldNodes, indirectPath: [], deferred: false },
    ]);
  } catch (error) {
    abandon(plan);
    throw error;
  }

  return plan;
}

/**
 * D-7: where the field being resolved is, which every position beneath it links back to, so a
 * select function can tell where in the query its field sits. Undefined when `info` does not name
 * the field it resolves (a caller building one by hand): the plan then starts at its own fields.
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
