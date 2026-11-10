import { completeValue, type MaybePromise } from '@pothos/core';
import { type IndirectInclude, type PathSegment, Plan } from '@pothos/selection-mapper';
import type { HasNoVariant } from '@prisma/orm-family-sql/orm-client';
import {
  type GraphQLNamedType,
  type GraphQLResolveInfo,
  type GraphQLSchema,
  getNamedType,
} from 'graphql';
import { PRISMA_CONFIG, PRISMA_MODEL } from '../constants.js';
import type { PrismaPlannedCollection } from '../types/collections.js';
import type { AnyContract } from '../types/models.js';
import type { MapperCollection, PrismaPlan } from './adapter.js';
import type { PrismaConfig } from './config.js';
import { variantOf } from './contract.js';
import { assertGraphQLJsInfo, InternalError } from './errors.js';
import { getModel, type PrismaModel } from './model.js';
import { EMPTY, type PrismaSelection } from './selections.js';

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
  config: PrismaConfig,
  context: object,
  target: PlanTarget,
  initial: PrismaSelection,
): MaybePromise<{ selection: PrismaSelection; model: PrismaModel } | undefined> {
  assertGraphQLJsInfo(info);
  const plan = Plan.fromInfo(config.adapter, { context, info, ...target, initial });
  return (
    plan &&
    completeValue(plan as MaybePromise<PrismaPlan>, (settled) => ({
      selection: settled.query(),
      model: settled.model,
    }))
  );
}

/** A variant's rows are narrowed to it, so the relations it declares can load. */
export function initialSelection(
  contract: AnyContract,
  modelKey: string | undefined,
  seed: PrismaSelection,
): PrismaSelection {
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
    return type?.extensions?.[PRISMA_MODEL] as string | undefined;
  };
  return !typeName && paths && paths.length > 1 ? undefined : modelAt(paths?.[0] ?? path ?? []);
}

function includeOf(type: GraphQLNamedType) {
  return type.extensions?.pothosIndirectInclude as IndirectInclude | undefined;
}

/** Plans the selection at `paths` beneath the field from `seed`, or the seed alone. */
export function nestedFromInfo(
  info: GraphQLResolveInfo,
  config: PrismaConfig,
  context: object,
  paths: PathSegment[][],
) {
  return (seed: PrismaSelection): MaybePromise<PrismaSelection> =>
    completeValue(
      planSelection(info, config, context, { paths }, seed),
      (planned) => planned?.selection ?? seed,
    );
}

export function applySelectionToCollection(
  collection: MapperCollection,
  modelKey: string,
  info: GraphQLResolveInfo,
  config: PrismaConfig,
  context: object,
): MaybePromise<MapperCollection> {
  const model = getModel(config.contract, modelKey);
  const initial = initialSelection(config.contract, modelKey, EMPTY);
  return completeValue(planSelection(info, config, context, {}, initial), (planned) => {
    const selection = planned?.selection ?? initial;
    return config.adapter.emit(collection, selection, planned?.model ?? model);
  });
}

export interface CollectionFromInfoOptions<C> extends PlanTarget {
  /**
   * The collection to load the rows from, without `include()`. The plugin loads the relations the
   * query selects.
   */
  collection: C;
  context: object;
  info: GraphQLResolveInfo;
}

/**
 * Returns `collection` with the selection of the field being resolved applied to it. Use it in a
 * resolver that loads rows itself, such as a mutation's. Rows read or written through the returned
 * collection resolve the query without loading again.
 *
 * Use `path` or `paths` when the rows are nested in the field's result (`['post']` for a payload's
 * `post`). Set `typeName` to the type the rows resolve as when the path leads to an interface or
 * union, or the collection is narrowed by `variant()`. In a subscription, call it in the event's
 * `resolve`. Rows loaded in `subscribe` are loaded again.
 */
// A collection narrowed by `variant()`, or one the compiler can't tell isn't, needs `typeName`.
export function collectionFromInfo<C extends HasNoVariant>(
  options: CollectionFromInfoOptions<C>,
): Promise<PrismaPlannedCollection<C>>;
export function collectionFromInfo<C extends object>(
  options: CollectionFromInfoOptions<C> & { typeName: string },
): Promise<PrismaPlannedCollection<C>>;
export async function collectionFromInfo<C extends object>({
  collection,
  context,
  info,
  ...target
}: CollectionFromInfoOptions<C>): Promise<PrismaPlannedCollection<C>> {
  const config = configFor(info.schema);
  if (target.typeName && !info.schema.getType(target.typeName)) {
    throw new InternalError(`collectionFromInfo's typeName '${target.typeName}' isn't a type.`);
  }
  const modelKey = plannedModelKey(info, target);
  const mapper = collection as unknown as MapperCollection;
  const planned = await planSelection(
    info,
    config,
    context,
    target,
    initialSelection(config.contract, modelKey, EMPTY),
  );
  const query = planned && config.adapter.emit(mapper, planned.selection, planned.model);
  return (query ?? mapper) as unknown as PrismaPlannedCollection<C>;
}

const schemaConfigs = new WeakMap<GraphQLSchema, PrismaConfig>();

function configFor(schema: GraphQLSchema): PrismaConfig {
  let config = schemaConfigs.get(schema);
  if (!config) {
    config = Object.values(schema.getTypeMap()).find((type) => type.extensions?.[PRISMA_CONFIG])
      ?.extensions?.[PRISMA_CONFIG] as PrismaConfig;
    schemaConfigs.set(schema, config);
  }
  return config;
}
