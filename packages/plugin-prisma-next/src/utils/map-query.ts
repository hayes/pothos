import { completeValue, type MaybePromise } from '@pothos/core';
import { type IndirectInclude, type PathSegment, Plan } from '@pothos/selection-mapper';
import type { HasNoVariant } from '@prisma/orm-family-sql/orm-client';
import {
  type GraphQLNamedType,
  type GraphQLResolveInfo,
  type GraphQLSchema,
  getNamedType,
} from 'graphql';
import { PRISMA_NEXT_CONFIG, PRISMA_NEXT_MODEL } from '../constants.js';
import type { PlannedCollection } from '../types/collections.js';
import type { AnyContract } from '../types/models.js';
import type { MapperCollection, PlannedQuery, PrismaNextPlan } from './adapter.js';
import type { PrismaNextConfig } from './config.js';
import { variantOf } from './contract.js';
import { assertGraphQLJsInfo } from './errors.js';
import { getModel, type PrismaNextModel } from './model.js';
import { appliesCursors, EMPTY, type PrismaNextSelection } from './selections.js';

interface PlanTarget {
  /** Paths to the selection from the field's return type (`[['edges', 'node'], ['nodes']]`). */
  paths?: PathSegment[][];
  /** One path to the selection, when `paths` isn't given. */
  path?: PathSegment[];
  /** The type the selection is read as, when it isn't the field's return type. */
  typeName?: string;
}

/** Undefined when nothing is selected under `paths`. A promise only for an async `select`. */
function planSelection(
  info: GraphQLResolveInfo,
  config: PrismaNextConfig,
  context: object,
  target: PlanTarget,
  initial: PrismaNextSelection,
): MaybePromise<{ selection: PrismaNextSelection; model: PrismaNextModel } | undefined> {
  assertGraphQLJsInfo(info);
  const plan = Plan.fromInfo(config.adapter, { context, info, ...target, initial });
  return (
    plan &&
    completeValue(plan as MaybePromise<PrismaNextPlan>, (settled) => ({
      selection: settled.query(),
      model: settled.model,
    }))
  );
}

/** A variant's rows are narrowed to it, so the relations it declares can load. */
export function initialSelection(
  contract: AnyContract,
  modelKey: string | undefined,
  seed: PrismaNextSelection,
): PrismaNextSelection {
  const variant = modelKey === undefined ? undefined : variantOf(contract, modelKey)?.value;
  return { ...seed, args: variant === undefined ? {} : { variant: { value: variant } } };
}

/** `typeName`'s model, or that of the type its one path leads to. */
function plannedModelKey(info: GraphQLResolveInfo, { typeName, path, paths }: PlanTarget) {
  const { schema } = info;
  const returnType = getNamedType(info.returnType);
  const modelAt = (steps: readonly PathSegment[]) => {
    let type: GraphQLNamedType | undefined = typeName ? schema.getType(typeName) : returnType;
    for (const step of typeName ? [] : [...(includeOf(returnType)?.path ?? []), ...steps]) {
      const { type: on, name } = typeof step === 'string' ? { name: step } : step;
      const parent = on ? schema.getType(on) : type;
      const field = parent && 'getFields' in parent ? parent.getFields()[name] : undefined;
      type = field && getNamedType(field.type);
    }
    for (let include = type && includeOf(type); include; include = type && includeOf(type)) {
      type = schema.getType(include.getType());
    }
    return type?.extensions?.[PRISMA_NEXT_MODEL] as string | undefined;
  };
  if (!typeName && paths && paths.length > 1) {
    return undefined;
  }
  return modelAt(paths?.[0] ?? path ?? []);
}

function includeOf(type: GraphQLNamedType) {
  return type.extensions?.pothosIndirectInclude as IndirectInclude | undefined;
}

/** Plans the selection at `paths` beneath the field from `seed`, or the seed alone. */
export function nestedFromInfo(
  info: GraphQLResolveInfo,
  config: PrismaNextConfig,
  context: object,
  paths: PathSegment[][],
) {
  return (seed: PrismaNextSelection): MaybePromise<PrismaNextSelection> =>
    completeValue(
      planSelection(info, config, context, { paths }, seed),
      (planned) => planned?.selection ?? seed,
    );
}

export function applySelectionToCollection(
  collection: MapperCollection,
  modelKey: string,
  info: GraphQLResolveInfo,
  config: PrismaNextConfig,
  context: object,
): MaybePromise<PlannedQuery> {
  const model = getModel(config.contract, modelKey);
  const initial = initialSelection(config.contract, modelKey, EMPTY);
  return completeValue(planSelection(info, config, context, {}, initial), (planned) => {
    const selection = planned?.selection ?? initial;
    return {
      query: config.adapter.emit(collection, selection, planned?.model ?? model),
      cursors: appliesCursors(selection),
    };
  });
}

export interface CollectionFromInfoOptions<C> extends PlanTarget {
  /** The collection to load the rows from, without `include()`: the selection includes relations. */
  collection: C;
  context: object;
  info: GraphQLResolveInfo;
}

/**
 * Applies the selection of the field `info` resolves to `collection`, for a resolver that loads
 * rows itself, such as a mutation's. `path`/`paths` select beneath the field (`['post']` for a
 * payload's `post`), and `typeName` names the type the rows resolve as.
 */
// A collection narrowed by `variant()`, or one the compiler can't tell isn't, needs `typeName`.
export function collectionFromInfo<C extends HasNoVariant>(
  options: CollectionFromInfoOptions<C>,
): Promise<PlannedCollection<C>>;
export function collectionFromInfo<C extends object>(
  options: CollectionFromInfoOptions<C> & { typeName: string },
): Promise<PlannedCollection<C>>;
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
    initialSelection(config.contract, plannedModelKey(info, target), EMPTY),
  );
  return planned
    ? (config.adapter.emit(
        mapper,
        planned.selection,
        planned.model,
      ) as unknown as PlannedCollection<C>)
    : (collection as PlannedCollection<C>);
}

const schemaConfigs = new WeakMap<GraphQLSchema, PrismaNextConfig>();

function configFor(schema: GraphQLSchema): PrismaNextConfig {
  let config = schemaConfigs.get(schema);
  if (!config) {
    config = Object.values(schema.getTypeMap()).find(
      (type) => type.extensions?.[PRISMA_NEXT_CONFIG],
    )?.extensions?.[PRISMA_NEXT_CONFIG] as PrismaNextConfig;
    schemaConfigs.set(schema, config);
  }
  return config;
}
