import './global-types.js';
import './prisma-next-connection.js';
import './prisma-next-field-builder.js';
import './schema-builder.js';
import SchemaBuilder, {
  BasePlugin,
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
import type { AnyContract } from './types.js';
import {
  fieldAliasPrefix,
  type MapperCollection,
  objectLevelFieldAlias,
  prismaNextAdapter,
} from './utils/adapter.js';
import { getPluginConfig, type PrismaNextConfig } from './utils/config.js';
import { assertVariantCollection, resolveContractModel, rootModelKey } from './utils/contract.js';
import { applySelectionToCollection } from './utils/map-query.js';
import { getModel } from './utils/model.js';
import { variantTypeNames } from './utils/variant-types.js';

export type {
  ConnectionNodeShape,
  ConnectionWrapRows,
  PrismaConnectionHelperOptions,
  PrismaConnectionHelpers,
} from './connection-helpers.js';
export { prismaConnectionHelpers } from './connection-helpers.js';
export { PrismaNextInterfaceRef, prismaInterfaceKey } from './interface-ref.js';
export { PrismaNextNodeRef, relayIDShapeKey } from './node-ref.js';
export { PrismaNextObjectRef, prismaModelKey } from './object-ref.js';
export { PrismaNextObjectFieldBuilder } from './prisma-next-object-field-builder.js';
export type {
  AnyContract,
  CollectionFor,
  ConnectionCollection,
  CursorSpec,
  ModelName,
  PrismaNextClient,
  PrismaNextConnectionFieldOptions,
  PrismaNextExecutionContext,
  PrismaNextInterfaceOptions,
  PrismaNextObjectFieldOptions,
  PrismaNextObjectOptions,
  PrismaNextPluginOptions,
  PrismaNextRelatedConnectionOptions,
  PrismaNextRelationAggregateOptions,
  PrismaNextRelationCountOptions,
  PrismaNextRelationOptions,
  PrismaNextRequestClient,
  PrismaNextRootFieldOptions,
  PrismaNextRootFieldWithInputOptions,
  ResolverCollection,
  Row,
} from './types.js';

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
  collection: MapperCollection,
  info: GraphQLResolveInfo,
  config: PrismaNextConfig,
  context: object,
  wantsList: boolean,
  modelName: string,
): Promise<unknown> {
  assertVariantCollection(config.contract, modelName, collection);
  let applied = (await applySelectionToCollection(
    collection,
    info,
    config,
    context,
  )) as unknown as {
    all: () => Promise<readonly unknown[]>;
    limit: (n: number) => unknown;
  };
  if (!wantsList) {
    applied = applied.limit(1) as typeof applied;
  }
  const rows = await applied.all();
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
  private get config() {
    return getPluginConfig(this.builder);
  }

  override onTypeConfig(typeConfig: PothosTypeConfig): PothosTypeConfig {
    if (typeConfig.kind !== 'Object' && typeConfig.kind !== 'Interface') {
      return typeConfig;
    }
    const { contract } = this.config;
    let model = typeConfig.extensions?.[PRISMA_NEXT_MODEL] as string | undefined;
    for (const iface of typeConfig.interfaces) {
      const ifaceConfig = this.buildCache.getTypeConfig(iface, 'Interface');
      const ifaceModel = ifaceConfig.extensions?.[PRISMA_NEXT_MODEL] as string | undefined;
      if (ifaceModel) {
        if (model && rootModelKey(contract, model) === rootModelKey(contract, ifaceModel)) {
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
    // Fails the schema build for a contract the planner can't represent.
    getModel(contract, model);
    return {
      ...typeConfig,
      extensions: {
        ...typeConfig.extensions,
        [PRISMA_NEXT_MODEL]: model,
      },
    };
  }

  override afterBuild(schema: GraphQLSchema): GraphQLSchema {
    const { contract } = this.config;
    for (const type of Object.values(schema.getTypeMap())) {
      if (isInterfaceType(type) && type.extensions?.[PRISMA_NEXT_DISCRIMINATED]) {
        variantTypeNames(contract, schema, type);
      }
    }
    return schema;
  }

  override wrapResolve(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object, unknown>,
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> {
    const ext = (fieldConfig.extensions ?? {}) as Record<string | symbol, unknown>;
    const config = this.config;
    const { contract } = config;

    if (ext[PRISMA_NEXT_PREPARED]) {
      const prepared = ext[PRISMA_NEXT_PREPARED] as PreparedFieldExtension;
      return async (parent, args, context, info) => {
        const result = await resolver(parent, args, context, info);
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
          result as MapperCollection,
          info,
          config,
          context,
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
    if (!modelName) {
      return resolver;
    }
    const modelRelations = resolveContractModel(contract, modelName)?.relations ?? {};
    const relationNames = Object.keys(modelRelations);
    const toOneRelations = Object.entries(modelRelations)
      .filter(([, relation]) => relation.cardinality !== '1:N' && relation.cardinality !== 'N:M')
      .map(([name]) => name);
    const typeRelations =
      typeSelect && !Array.isArray(typeSelect) && typeof typeSelect === 'object'
        ? Object.keys(typeSelect).filter((key) => modelRelations[key] !== undefined)
        : [];
    const typeAlias = objectLevelFieldAlias(declaringTypeConfig.name);
    const hasTypeSelect = typeRelations.length > 0;
    const hasFieldSelect = isObjectOrCallableSelect || !!ext[PRISMA_NEXT_FIELD_SELECT];
    const indirect = ext.pothosIndirectInclude as
      | { path?: unknown[]; paths?: unknown[] }
      | undefined;
    const isSameRow = !!indirect && !indirect.path?.length && !indirect.paths?.length;
    const needsNormalization = hasTypeSelect || hasFieldSelect || isSameRow;

    const resolveLoaded: GraphQLFieldResolver<unknown, Types['Context'], object> = (
      parent,
      args,
      context,
      info,
    ) => {
      if (!needsNormalization || parent == null || typeof parent !== 'object') {
        return resolver(parent, args, context, info);
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
      const result = resolver(overlay, args, context, info);
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
    const hasFieldDependencies =
      isSameRow ||
      !!ext[PRISMA_NEXT_FIELD_SELECT] ||
      typeof ext.pothosExposedField === 'string' ||
      typeof selectOpt === 'function' ||
      (selectOpt != null && typeof selectOpt === 'object' && Object.keys(selectOpt).length > 0);
    const adapter = prismaNextAdapter(contract);
    const fieldSelect = ext[PRISMA_NEXT_FIELD_SELECT];
    const ownColumns =
      typeof ext.pothosExposedField === 'string'
        ? [ext.pothosExposedField]
        : Array.isArray(selectOpt)
          ? (selectOpt as string[])
          : typeof fieldSelect === 'object' && fieldSelect !== null && !('relations' in fieldSelect)
            ? (fieldSelect as { columns?: string[] }).columns
            : undefined;
    return (parent, args, context, info) => {
      if (!parent || typeof parent !== 'object') {
        return resolveLoaded(parent, args, context, info);
      }
      // Excludes the identity columns that are only added for fallback loading.
      const dependencies = adapter.typePrerequisite(info.parentType);
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
        getLoaderMapping(context, info.path, info.parentType.name, parent) ??
        inheritedMapping(context, info, parent, contract);
      if (mapping) {
        setRowMappings(context, info, mapping.nested);
        return resolveLoaded(parent, args, context, info);
      }
      return config
        .loader(context, modelName)
        .loadSelection(info, parent)
        .then((loaded) => resolveLoaded(loaded, args, context, info));
    };
  }
}

SchemaBuilder.registerPlugin(pluginName, PothosPrismaNextPlugin);
