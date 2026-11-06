import { completeValue, type MaybePromise } from '@pothos/core';
import { type PathSegment, Plan } from '@pothos/selection-mapper';
import type { GraphQLResolveInfo, GraphQLSchema } from 'graphql';
import { PRISMA_NEXT_CONFIG } from '../constants.js';
import type { PlannedCollection } from '../types/collections.js';
import type { MapperCollection, PrismaNextPlan } from './adapter.js';
import type { PrismaNextConfig } from './config.js';
import { assertGraphQLJsInfo } from './errors.js';
import type { PrismaNextModel } from './model.js';
import { EMPTY, type PrismaNextSelection, registerPlanRoots } from './selections.js';

interface PlanTarget {
  /** Paths to the selection from the field's return type (`[['edges', 'node'], ['nodes']]`). */
  paths?: PathSegment[][];
  /** One path to the selection, when `paths` isn't given. */
  path?: PathSegment[];
  /** The type the selection is read as, when it isn't the field's return type. */
  typeName?: string;
}

interface ApplySelectionOptions extends PlanTarget {
  /** What the root loads whatever is selected, such as cursor columns. */
  seed?: PrismaNextSelection;
}

/**
 * The query for the selection of the field `info` resolves, or of what `paths` lead to, with the
 * mappings its resolvers read recorded. Undefined when nothing is selected under `paths`. Returns a
 * promise only when a `select` callback beneath the field is async.
 */
export function planSelection(
  info: GraphQLResolveInfo,
  config: PrismaNextConfig,
  context: object,
  target: PlanTarget,
  initial: PrismaNextSelection,
): MaybePromise<{ selection: PrismaNextSelection; model: PrismaNextModel } | undefined> {
  assertGraphQLJsInfo(info);
  registerPlanRoots(info);
  const plan = Plan.fromInfo(config.adapter, { context, info, ...target, initial });
  return (
    plan &&
    completeValue(plan as MaybePromise<PrismaNextPlan>, (settled) => ({
      selection: settled.query(),
      model: settled.model,
    }))
  );
}

/** The selection a collection starts from: relations declared on a variant need it narrowed. */
function initialSelection(
  collection: MapperCollection,
  seed: PrismaNextSelection,
): PrismaNextSelection {
  const variant = collection.state?.variantValue;
  return { ...seed, args: typeof variant === 'string' ? { variant: { value: variant } } : {} };
}

/**
 * Applies the selection of the field `info` resolves to `collection` of `model`. Returns a promise
 * only when a `select` callback beneath the field is async.
 */
export function applySelectionToCollection(
  collection: MapperCollection,
  model: PrismaNextModel,
  info: GraphQLResolveInfo,
  config: PrismaNextConfig,
  context: object,
  { seed = EMPTY, ...target }: ApplySelectionOptions = {},
): MaybePromise<MapperCollection> {
  const initial = initialSelection(collection, seed);
  return completeValue(planSelection(info, config, context, target, initial), (planned) =>
    config.adapter.emit(
      collection,
      planned?.selection ?? initial,
      planned?.model ?? model,
      context,
    ),
  );
}

export interface CollectionFromInfoOptions<C> extends PlanTarget {
  /** The collection to load the rows from, without `include()`: the selection includes relations. */
  collection: C;
  context: object;
  info: GraphQLResolveInfo;
}

/**
 * Applies the selection of the field `info` resolves to `collection`, for a resolver that loads rows
 * itself, such as a mutation's. With `path` or `paths` it applies the selection beneath them, such
 * as `['post']` for a payload's `post` field, and `typeName` names the type the rows resolve as
 * when the path leads to an interface or union. The rows the returned collection's reads and writes
 * return resolve the selection without loading again.
 *
 * Returns a promise, since a `select` beneath the field may be async.
 */
export async function collectionFromInfo<C extends object>({
  collection,
  context,
  info,
  ...target
}: CollectionFromInfoOptions<C>): Promise<PlannedCollection<C>> {
  const config = configFor(info.schema);
  const mapper = collection as unknown as MapperCollection;
  const planned = await planSelection(
    info,
    config,
    context,
    target,
    initialSelection(mapper, EMPTY),
  );
  // The rows it returns are handed on as they are: the field returning them copies each for its
  // type.
  return planned
    ? (config.adapter.emit(
        mapper,
        planned.selection,
        planned.model,
        context,
      ) as unknown as PlannedCollection<C>)
    : (collection as PlannedCollection<C>);
}

const schemaConfigs = new WeakMap<GraphQLSchema, PrismaNextConfig>();

/** The config of the builder that built `schema`, read from its prisma types. */
function configFor(schema: GraphQLSchema): PrismaNextConfig {
  let config = schemaConfigs.get(schema);
  if (!config) {
    for (const type of Object.values(schema.getTypeMap())) {
      config ??= type.extensions?.[PRISMA_NEXT_CONFIG] as PrismaNextConfig | undefined;
    }
    schemaConfigs.set(schema, config!);
  }
  return config!;
}
