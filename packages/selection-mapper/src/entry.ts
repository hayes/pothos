/**
 * The entry points: E-1 (`queryFromInfo`, `planFromInfo`, `queryFromPlan`) and E-2
 * (`rowPlanFromInfo`).
 */
import { type GraphQLResolveInfo, getNamedType } from 'graphql';
import { abandon, finish } from './async.js';
import { setLoaderMappings } from './loader-map.js';
import {
  findMatches,
  type IndirectPathSegment,
  includeOf,
  matchesForModel,
  modelOf,
  type PathSegment,
} from './matches.js';
import type { Node, NodeBase } from './node.js';
import { play } from './play.js';
import type { Adapter, EntryOptions, Plan, PlayedPlan, Position } from './types.js';
import { createPlan, enterParentType, walkBranches, walkField } from './walk.js';

/**
 * E-1: the query for the field `info` resolves, with its loader mappings recorded (L-2).
 * Declared synchronous (A-7): a promise is returned only when a callback returned one.
 */
export function queryFromInfo<Model, Query, NodeType extends NodeBase<Model> = Node<Model>>(
  adapter: Adapter<Model, Query, NodeType>,
  options: EntryOptions<Query>,
): Query {
  const plan = buildPlan(adapter, options);

  if (!plan) {
    // Nothing is selected under the paths: there is nothing to plan and nothing to map, so the
    // caller gets back its own selection.
    return options.initial ?? ({} as Query);
  }

  return finish(plan, playAndEmit);
}

/**
 * E-1 without playing the plan into a query: the plan itself, or undefined when paths are given
 * and nothing is selected under them. Declared synchronous like `queryFromInfo` (A-7). A plugin
 * that must hand a resolver a synchronous query builder settles this first, then plays the plan
 * behind the resolver's own selection with `queryFromPlan` once the resolver asks for it.
 *
 * The plan is played once here, so a conflict between two type-level selections (S-7) is still
 * reported before the resolver runs — where it was reported when the traversal merged as it
 * walked — rather than only inside a `query()` a resolver may never call. That play is kept: a
 * later one whose seed conflicts with none of it takes it whole instead of playing the list
 * again, so settling the plan here costs the resolver's own play nothing.
 */
export function planFromInfo<Model, Query, NodeType extends NodeBase<Model> = Node<Model>>(
  adapter: Adapter<Model, Query, NodeType>,
  options: EntryOptions<Query>,
): Plan<Model, Query, NodeType> | undefined {
  const plan = buildPlan(adapter, options);

  return plan && finish(plan, validated);
}

/**
 * E-1 from a settled plan: the plan played behind `select`, its loader mappings recorded (L-2)
 * and its query serialized (M-6, L-5). Synchronous: the plan must be one `planFromInfo` returned,
 * and when that was a promise, the plan it resolved to. A play runs no user callback, so this is
 * synchronous whether or not the plan was async.
 *
 * `select` takes the place of `initial`: it is merged first, so a relation or extra the document
 * plans with other arguments loses (M-4) and its field loads on its own (L-3). Every merge the
 * traversal collected is offered to the node `select` seeded, including one that lost to another
 * occurrence of itself while the document was walked, so this is the same query, and the same
 * mappings, as `queryFromInfo` walked with `select` as its `initial`.
 */
export function queryFromPlan<Model, Query, NodeType extends NodeBase<Model> = Node<Model>>(
  plan: Plan<Model, Query, NodeType>,
  select?: Query,
): Query {
  return emit(play(plan, select));
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
): PlayedPlan<Model, Query, NodeType> {
  const type = info.parentType;
  const plan = createPlan(adapter, { context, info, skipDeferredFragments }, type);

  try {
    // Every node selecting the field (one per fragment it appears under) plans into the same
    // row, so the loaded row satisfies each of them.
    for (const fieldNode of info.fieldNodes) {
      walkField(plan, type, fieldNode, []);
    }
  } catch (error) {
    abandon(plan);
    throw error;
  }

  return finish(plan, enterParentType, type);
}

/** L-2, M-6: a play's mappings recorded for the resolvers beneath it, and its node serialized. */
function emit<Model, Query, NodeType extends NodeBase<Model>>({
  plan,
  root,
  mappings,
}: PlayedPlan<Model, Query, NodeType>): Query {
  setLoaderMappings(plan.context, plan.info, mappings);

  return plan.adapter.accumulator.emit(root);
}

/** `finish` needs something to run once the plan has settled; `queryFromInfo` wants the query. */
function playAndEmit<Model, Query, NodeType extends NodeBase<Model>>(
  plan: Plan<Model, Query, NodeType>,
): Query {
  return emit(play(plan));
}

/** `planFromInfo` wants the plan, played once so a play-time error is raised now. */
function validated<Model, Query, NodeType extends NodeBase<Model>>(
  plan: Plan<Model, Query, NodeType>,
) {
  plan.played = play(plan);

  return plan;
}

/** E-1: undefined when paths are given and nothing is selected under them. */
function buildPlan<Model, Query, NodeType extends NodeBase<Model>>(
  adapter: Adapter<Model, Query, NodeType>,
  options: EntryOptions<Query>,
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

    const plan = createPlan(adapter, options, typeName ? target : matches[0].type, position);

    try {
      // Every match is planned into the one root, entered under its own type first (W-11).
      walkBranches(
        plan,
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

  const plan = createPlan(adapter, options, target, position);

  try {
    walkBranches(plan, [
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
