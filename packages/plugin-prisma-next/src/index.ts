import './global-types.js';
import './prisma-next-connection.js';
import './prisma-next-field-builder.js';
import './schema-builder.js';
import SchemaBuilder, {
  BasePlugin,
  createContextCache,
  isThenable,
  type PothosOutputFieldConfig,
  PothosSchemaError,
  type PothosTypeConfig,
  type SchemaTypes,
} from '@pothos/core';
import { getLoaderMapping, setRowMappings } from '@pothos/selection-mapper';
import {
  type GraphQLFieldResolver,
  type GraphQLResolveInfo,
  type GraphQLSchema,
  getNamedType,
  isInterfaceType,
} from 'graphql';
import {
  PRISMA_NEXT_DISCRIMINATED,
  PRISMA_NEXT_FIELD_SELECT,
  PRISMA_NEXT_MODEL,
  PRISMA_NEXT_PREPARED,
  PRISMA_NEXT_SELECT,
} from './constants.js';
import type { PreparedFieldExtension } from './extensions.js';
import { ModelLoader } from './model-loader.js';
import type { AnyContract } from './types.js';
import { fieldAliasPrefix, objectLevelFieldAlias, prismaNextAdapter } from './utils/adapter.js';
import { createApply } from './utils/apply.js';
import {
  assertVariantCollection,
  collectionForModel,
  resolveContractModel,
  rootModelKey,
} from './utils/contract.js';
import { buildRelationMeta, getModel } from './utils/model.js';
import { mapperOptionsFromPluginOpts, readPluginOptions } from './utils/options.js';
import { variantTypeNames } from './utils/variant-types.js';

export type {
  AggregateBuilder,
  AggregateResult,
  AggregateSpec,
  Collection,
  CreateInput,
  GroupedCollection,
  ModelAccessor,
  RelationFilterAccessor,
  RelationPredicate,
  ShorthandWhereFilter,
  UniqueConstraintCriterion,
} from '@prisma/orm-family-sql/orm-client';
export { all, and, not, or } from '@prisma/orm-family-sql/orm-client';
export type {
  ConnectionNodeShape,
  ConnectionWrapRows,
  PrismaConnectionHelperOptions,
  PrismaConnectionHelpers,
} from './connection-helpers.js';
export { prismaConnectionHelpers } from './connection-helpers.js';
export { PRISMA_NEXT_MODEL, PRISMA_NEXT_PREPARED, PRISMA_NEXT_SELECT } from './constants.js';
export type { PreparedFieldExtension, RefineCallback } from './extensions.js';
export { PrismaNextInterfaceRef, prismaInterfaceKey } from './interface-ref.js';
export { PrismaNextNodeRef, relayIDShapeKey } from './node-ref.js';
export { PrismaNextObjectRef, prismaModelKey } from './object-ref.js';
export { PrismaNextObjectFieldBuilder } from './prisma-next-object-field-builder.js';
export * from './types.js';
export {
  type MapperCollection,
  type PrismaNextSpec,
  prismaNextAdapter,
} from './utils/adapter.js';
export type { Apply } from './utils/apply.js';
export { createApply } from './utils/apply.js';
export { rebrandForVariant } from './utils/branding.js';
export {
  type CursorValueCodec,
  decodeCursor as parsePrismaNextCursor,
  encodeCursor as formatPrismaNextCursor,
} from './utils/cursors.js';
export {
  type ApplySelectionOptions,
  applySelectionToCollection,
  type IndirectInclude,
} from './utils/map-query.js';
export type {
  PrismaNextModel,
  PrismaNextRelation,
  PrismaNextRelationMeta,
} from './utils/model.js';
export { getInterfaceRefFromContractModel, getRefFromContractModel } from './utils/refs.js';

const pluginName = 'prismaNext';

export default pluginName;

function isOrmCollection(value: unknown): boolean {
  if (value == null || typeof value !== 'object') {
    return false;
  }
  const v = value as { select?: unknown; include?: unknown; where?: unknown; all?: unknown };
  return (
    typeof v.select === 'function' &&
    typeof v.include === 'function' &&
    typeof v.where === 'function' &&
    typeof v.all === 'function'
  );
}

async function materializeCollection(
  collection: unknown,
  info: GraphQLResolveInfo,
  contract: AnyContract,
  context: unknown,
  mapperOpts: ReturnType<typeof mapperOptionsFromPluginOpts>,
  wantsList: boolean,
  modelName: string,
): Promise<unknown> {
  assertVariantCollection(contract, modelName, collection as never);
  const apply = createApply({ info, contract, context, mapperOpts });
  let applied = (await apply(collection)) as {
    all: () => Promise<readonly unknown[]>;
    limit?: (n: number) => unknown;
  };
  if (!wantsList && typeof applied.limit === 'function') {
    applied = applied.limit(1) as typeof applied;
  }
  const rows = (await applied.all()) as readonly unknown[];
  return wantsList ? rows : (rows[0] ?? null);
}

// The original row, kept on wrappers and overlays so its combine maps stay readable.
const sourceRow = Symbol('prismaNextSourceRow');

// Slot prefixes a row's children may be under: a shared to-one include scopes them by consumer.
const rowScopes = Symbol('prismaNextRowScopes');
type ScopedRow = { [sourceRow]?: object; [rowScopes]?: readonly string[] };

function childScopes(parent: object, alias: string): string[] {
  return [...((parent as ScopedRow)[rowScopes] ?? []).map((scope) => `${scope}:${alias}`), alias];
}

function scopedRow(row: object, scopes: readonly string[]): object {
  const wrapper = Object.create(row) as object;
  Object.defineProperties(wrapper, {
    [sourceRow]: { value: (row as ScopedRow)[sourceRow] ?? row },
    [rowScopes]: { value: scopes },
  });
  return wrapper;
}

function selectedPrefix(slot: object, scopes: readonly string[]): string | undefined {
  const keys = Object.keys(slot);
  return scopes.map(fieldAliasPrefix).find((prefix) => keys.some((key) => key.startsWith(prefix)));
}

function liftSlots(overlay: object, slot: object, scopes: readonly string[]) {
  const prefix = selectedPrefix(slot, scopes);
  if (!prefix) {
    return;
  }
  for (const key of Object.keys(slot)) {
    if (key.startsWith(prefix)) {
      Object.defineProperty(overlay, key.slice(prefix.length), {
        value: (slot as Record<string, unknown>)[key],
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
  }
}

/** Lifts type-level combine slots onto an overlay, leaving the shared row untouched. */
function normalizeParentForType(
  parent: object,
  relations: readonly string[],
  alias: string,
): Record<string, unknown> {
  const overlay = Object.create(parent) as Record<string, unknown>;
  const source = (parent as ScopedRow)[sourceRow] ?? parent;
  Object.defineProperty(overlay, sourceRow, { value: source });
  const scopes = childScopes(parent, alias);
  for (const relation of relations) {
    const slot = (source as Record<string, unknown>)[relation];
    if (slot && typeof slot === 'object' && !Array.isArray(slot)) {
      liftSlots(overlay, slot, scopes);
    }
  }
  return overlay;
}

/** Fields planned on an interface are recorded there but resolve on the concrete type. */
function inheritedMapping(
  context: object,
  info: GraphQLResolveInfo,
  parent: object,
  contract: AnyContract,
) {
  const model = info.parentType.extensions?.[PRISMA_NEXT_MODEL] as string | undefined;
  if (!model) {
    return null;
  }
  for (const iface of info.parentType.getInterfaces()) {
    const ifaceModel = iface.extensions?.[PRISMA_NEXT_MODEL] as string | undefined;
    if (
      ifaceModel &&
      iface.getFields()[info.fieldName] &&
      rootModelKey(contract, ifaceModel) === rootModelKey(contract, model)
    ) {
      const mapping = getLoaderMapping(context, info.path, iface.name, parent);
      if (mapping) {
        return mapping;
      }
    }
  }
  return null;
}

export class PothosPrismaNextPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  private readonly loaders = createContextCache(() => new Map<string, ModelLoader>());

  override onTypeConfig(typeConfig: PothosTypeConfig): PothosTypeConfig {
    if (typeConfig.kind !== 'Object' && typeConfig.kind !== 'Interface') {
      return typeConfig;
    }
    let model = typeConfig.extensions?.[PRISMA_NEXT_MODEL] as string | undefined;
    const opts = readPluginOptions<AnyContract>(this.builder);
    for (const iface of typeConfig.interfaces) {
      const ifaceConfig = this.buildCache.getTypeConfig(iface, 'Interface');
      const ifaceModel = ifaceConfig.extensions?.[PRISMA_NEXT_MODEL] as string | undefined;
      if (ifaceModel) {
        if (
          model &&
          opts?.contract &&
          rootModelKey(opts.contract, model) === rootModelKey(opts.contract, ifaceModel)
        ) {
          // A variant keeps its own model when it implements its hierarchy's interface.
          continue;
        }
        if (model && model !== ifaceModel) {
          throw new PothosSchemaError(
            `prismaObject '${typeConfig.name}' is based on model '${model}' but implements ` +
              `prismaInterface '${ifaceConfig.name}' which is based on '${ifaceModel}'. ` +
              'PrismaObjects must share a contract model with the PrismaInterfaces they extend.',
          );
        }
        model = ifaceModel;
      }
    }
    if (model === undefined) {
      return typeConfig;
    }
    if (opts?.contract) {
      buildRelationMeta(model, opts.contract, typeConfig.name);
      // Fails the schema build for a contract the planner can't represent.
      getModel(opts.contract, model);
    }
    return {
      ...typeConfig,
      extensions: {
        ...typeConfig.extensions,
        [PRISMA_NEXT_MODEL]: model,
      },
    };
  }

  override afterBuild(schema: GraphQLSchema): GraphQLSchema {
    const contract = readPluginOptions<AnyContract>(this.builder)?.contract;
    if (contract) {
      for (const type of Object.values(schema.getTypeMap())) {
        if (isInterfaceType(type) && type.extensions?.[PRISMA_NEXT_DISCRIMINATED]) {
          variantTypeNames(contract, schema, type);
        }
      }
    }
    return schema;
  }

  override wrapResolve(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object, unknown>,
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> {
    const ext = (fieldConfig.extensions ?? {}) as Record<string | symbol, unknown>;

    if (ext[PRISMA_NEXT_PREPARED]) {
      const prepared = ext[PRISMA_NEXT_PREPARED] as PreparedFieldExtension;
      const opts = readPluginOptions<AnyContract>(this.builder);
      if (!opts) {
        throw new PothosSchemaError('t.prismaField requires builder.options.prismaNext to be set.');
      }
      const mapperOpts = mapperOptionsFromPluginOpts(opts);
      const contract = opts.contract;
      return async (parent, args, context, info) => {
        const raw = (
          resolver as unknown as (
            parent: unknown,
            args: unknown,
            context: unknown,
            info: GraphQLResolveInfo,
          ) => unknown
        )(parent, args, context, info);
        const result =
          raw && typeof (raw as { then?: unknown }).then === 'function'
            ? await (raw as Promise<unknown>)
            : raw;

        if (result == null) {
          return result;
        }
        if (!isOrmCollection(result)) {
          throw new PothosSchemaError(
            `t.prismaField '${info.parentType.name}.${info.fieldName}' must return an ORM Collection or null. ` +
              'Return the collection before executing it so the complete GraphQL selection can be applied.',
          );
        }
        return materializeCollection(
          result,
          info,
          contract,
          context,
          mapperOpts,
          prepared.isList,
          prepared.modelName,
        );
      };
    }

    // Fields with a `select` resolve against an overlay of the parent with their `<alias>:`
    // combine slots lifted onto it.
    const pothosOpts = (fieldConfig as unknown as { pothosOptions?: { select?: unknown } })
      .pothosOptions;
    const selectOpt = pothosOpts?.select;
    const isObjectOrCallableSelect =
      selectOpt !== undefined &&
      ((typeof selectOpt === 'object' && selectOpt !== null && !Array.isArray(selectOpt)) ||
        typeof selectOpt === 'function');
    const parentTypeConfig = this.buildCache.getTypeConfig(fieldConfig.parentType);
    const declaringTypeConfig = fieldConfig.declaringType
      ? this.buildCache.getTypeConfig(fieldConfig.declaringType, 'Interface')
      : parentTypeConfig;
    const typeSelect = declaringTypeConfig.extensions?.[PRISMA_NEXT_SELECT];
    const modelName = parentTypeConfig.extensions?.[PRISMA_NEXT_MODEL] as string | undefined;
    const pluginOptions = readPluginOptions<AnyContract>(this.builder);
    const contract = pluginOptions?.contract;
    const collections = pluginOptions?.collections;
    const modelRelations =
      contract && modelName ? resolveContractModel(contract, modelName)?.relations : undefined;
    const relationNames = Object.keys(modelRelations ?? {});
    const toOneRelations = Object.entries(modelRelations ?? {})
      .filter(([, relation]) => relation.cardinality !== '1:N' && relation.cardinality !== 'N:M')
      .map(([name]) => name);
    const typeRelations =
      typeSelect && !Array.isArray(typeSelect) && typeof typeSelect === 'object'
        ? Object.keys(typeSelect).filter((key) => modelRelations?.[key] !== undefined)
        : [];
    const typeAlias = objectLevelFieldAlias(declaringTypeConfig.name);
    const hasTypeSelect = typeRelations.length > 0;
    const hasFieldSelect = isObjectOrCallableSelect || !!ext[PRISMA_NEXT_FIELD_SELECT];
    const indirect = ext.pothosIndirectInclude as
      | { path?: unknown[]; paths?: unknown[] }
      | undefined;
    const isSameRow = !!indirect && !indirect.path?.length && !indirect.paths?.length;
    const needsNormalization = hasTypeSelect || hasFieldSelect || isSameRow;
    if (!needsNormalization && !(modelName && collections)) {
      return resolver;
    }
    const baseResolver = resolver;

    const resolveLoaded: GraphQLFieldResolver<unknown, Types['Context'], object> = (
      parent,
      args,
      context,
      info,
    ) => {
      if (!needsNormalization || parent == null || typeof parent !== 'object') {
        return baseResolver(parent, args, context, info);
      }
      const alias = info.fieldNodes[0]?.alias?.value ?? info.fieldName;
      const scopes = childScopes(parent, alias);
      const p = ((parent as { [sourceRow]?: object })[sourceRow] ?? parent) as Record<
        string,
        unknown
      >;
      const overlay = normalizeParentForType(parent, typeRelations, typeAlias);
      // Only relations are scanned: a JSON column's keys could match a client-chosen alias.
      for (const key of hasFieldSelect ? relationNames : []) {
        const slot = p[key];
        if (slot && typeof slot === 'object' && !Array.isArray(slot)) {
          liftSlots(overlay, slot, scopes);
        }
      }
      // Scoped before other plugins (errors result wrappers) transform the return value.
      if (hasFieldSelect) {
        for (const name of toOneRelations) {
          const value = overlay[name];
          if (value && typeof value === 'object' && !Array.isArray(value)) {
            Object.defineProperty(overlay, name, {
              value: scopedRow(value, scopes),
              enumerable: true,
              configurable: true,
              writable: true,
            });
          }
        }
      }
      const result = baseResolver(overlay, args, context, info);
      const finish = (value: unknown) => {
        if (!value || typeof value !== 'object' || value instanceof Error) {
          return value;
        }
        if (Array.isArray(value)) {
          return value.some(
            (row) => row && typeof row === 'object' && (row as ScopedRow)[rowScopes],
          )
            ? value.map((row) => (row && typeof row === 'object' ? scopedRow(row, []) : row))
            : value;
        }
        if (isSameRow) {
          return scopedRow(value, scopes);
        }
        if (getNamedType(info.returnType).extensions?.[PRISMA_NEXT_MODEL]) {
          return (value as ScopedRow)[rowScopes] === scopes ? value : scopedRow(value, scopes);
        }
        return value;
      };
      return isThenable(result) ? Promise.resolve(result).then(finish) : finish(result);
    };
    if (!modelName || !collections || !contract) {
      return resolveLoaded;
    }
    const hasFieldDependencies =
      isSameRow ||
      !!ext[PRISMA_NEXT_FIELD_SELECT] ||
      typeof ext.pothosExposedField === 'string' ||
      typeof selectOpt === 'function' ||
      (selectOpt != null && typeof selectOpt === 'object' && Object.keys(selectOpt).length > 0);
    // Excludes the identity columns that are only added for fallback loading.
    const dependencyAdapter = prismaNextAdapter(contract, true);
    const ownColumns =
      typeof ext.pothosExposedField === 'string'
        ? [ext.pothosExposedField]
        : Array.isArray(selectOpt)
          ? (selectOpt as string[])
          : undefined;
    return (parent, args, context, info) => {
      if (!parent || typeof parent !== 'object') {
        return resolveLoaded(parent, args, context, info);
      }
      const dependencies = dependencyAdapter.typePrerequisite(info.parentType);
      const row = parent as Record<string, unknown>;
      const typeDependenciesLoaded =
        !Object.keys(dependencies?.relations ?? {}).length &&
        (dependencies?.columns ?? []).every((column) => row[column] !== undefined);
      // The row may not exist anymore (the result of a delete), so fields satisfied by its own
      // columns don't query.
      if (
        typeDependenciesLoaded &&
        (!hasFieldDependencies || ownColumns?.every((column) => row[column] !== undefined))
      ) {
        return resolveLoaded(parent, args, context, info);
      }
      const mapping =
        getLoaderMapping(context as object, info.path, info.parentType.name, parent) ??
        inheritedMapping(context as object, info, parent, contract);
      if (mapping) {
        setRowMappings(context as object, info, mapping.nested);
        return resolveLoaded(parent, args, context, info);
      }
      const loaders = this.loaders(context as object);
      let loader = loaders.get(modelName);
      if (!loader) {
        loader = new ModelLoader(
          context as object,
          contract,
          modelName,
          () =>
            collectionForModel(
              contract,
              typeof collections === 'function' ? collections(context) : collections,
              rootModelKey(contract, modelName),
            ) as never,
          pluginOptions.skipDeferredFragments ?? true,
          pluginOptions.context,
        );
        loaders.set(modelName, loader);
      }
      return loader
        .loadSelection(info, parent)
        .then((row) => resolveLoaded(row, args, context, info));
    };
  }
}

SchemaBuilder.registerPlugin(pluginName, PothosPrismaNextPlugin);
