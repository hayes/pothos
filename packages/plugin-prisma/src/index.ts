import './global-types.js';
import './schema-builder.js';
import './field-builder.js';
import SchemaBuilder, {
  BasePlugin,
  type BuildCache,
  type PothosOutputFieldConfig,
  PothosSchemaError,
  type PothosTypeConfig,
  type SchemaTypes,
} from '@pothos/core';
import { getLoaderMapping, setLoaderMappings } from '@pothos/selection-mapper';
import type { GraphQLFieldResolver, GraphQLResolveInfo } from 'graphql';
import type { ModelLoader } from './model-loader.js';
import { PrismaObjectFieldBuilder as InternalPrismaObjectFieldBuilder } from './prisma-field-builder.js';
import type { IncludeMap, PrismaModelTypes } from './types.js';
import { INCLUDE_ALL } from './util/adapter.js';
import { formatPrismaCursor, parsePrismaCursor } from './util/cursors.js';
import { getModel, getRefFromModel } from './util/datamodel.js';
import { queryFromInfo } from './util/map-query.js';
import type { FieldMap } from './util/relation-map.js';

export { prismaConnectionHelpers } from './connection-helpers.js';
export { PrismaInterfaceRef } from './interface-ref.js';
export { PrismaNodeRef } from './node-ref.js';
export { PrismaObjectRef, prismaModelKey } from './object-ref.js';
export * from './types.js';
export { prismaClientCache } from './util/get-client.js';

const pluginName = 'prisma';

export default pluginName;

export { formatPrismaCursor, getModel, getRefFromModel, parsePrismaCursor, queryFromInfo };

export type PrismaObjectFieldBuilder<
  Types extends SchemaTypes,
  ParentShape,
> = PothosSchemaTypes.ObjectFieldBuilder<Types, ParentShape>;

export const ObjectFieldBuilder = InternalPrismaObjectFieldBuilder as new <
  Types extends SchemaTypes,
  Model extends PrismaModelTypes,
  Shape extends object = Model['Shape'],
>(
  typename: string,
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
) => PothosSchemaTypes.PrismaObjectFieldBuilder<Types, Model, Shape>;

export class PothosPrismaPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  constructor(cache: BuildCache<Types>) {
    super(cache, pluginName);
  }

  override onTypeConfig(typeConfig: PothosTypeConfig): PothosTypeConfig {
    if (typeConfig.kind !== 'Object' && typeConfig.kind !== 'Interface') {
      return typeConfig;
    }

    let model = typeConfig.extensions?.pothosPrismaModel as string | undefined;
    let fieldMap = typeConfig.extensions?.pothosPrismaFieldMap as FieldMap | undefined;

    for (const iface of typeConfig.interfaces) {
      const interfaceConfig = this.buildCache.getTypeConfig(iface, 'Interface');
      const interfaceModel = interfaceConfig.extensions?.pothosPrismaModel as string | undefined;

      if (interfaceModel) {
        if (model && model !== interfaceModel) {
          throw new PothosSchemaError(
            `PrismaObjects must be based on the same prisma model as any PrismaInterfaces they extend. ${typeConfig.name} uses ${model} and ${iface.name} uses ${interfaceModel}`,
          );
        }

        model = interfaceModel;
        // A plain object type implementing a prisma interface is walked with the interface's
        // field map, so fragments on it plan the relations it inherits.
        fieldMap ??= interfaceConfig.extensions?.pothosPrismaFieldMap as FieldMap | undefined;
      }
    }

    const { pothosPrismaSelect: select, pothosPrismaInclude: include } = (typeConfig.extensions ??
      {}) as { pothosPrismaSelect?: IncludeMap; pothosPrismaInclude?: IncludeMap };

    return {
      ...typeConfig,
      extensions: {
        ...typeConfig.extensions,
        pothosPrismaModel: model,
        pothosPrismaFieldMap: fieldMap,
        // The type-level selection merged whenever the type is walked (S-1), built once so the
        // walk allocates nothing per type: a model type without a `select` is include mode.
        pothosPrismaTypeSelection:
          select || include ? Object.freeze({ select, include }) : model ? INCLUDE_ALL : undefined,
      },
    };
  }

  override onOutputFieldConfig(
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): PothosOutputFieldConfig<Types> | null {
    if (fieldConfig.kind === 'PrismaObject' && fieldConfig.pothosOptions.select) {
      const { select } = fieldConfig.pothosOptions;
      return {
        ...fieldConfig,
        extensions: {
          ...fieldConfig.extensions,
          pothosPrismaSelect:
            typeof select === 'function'
              ? (
                  args: {},
                  ctx: Types['Context'],
                  nestedQuery: (query: unknown, path?: string[], type?: string) => never,
                ) => {
                  const selected = (
                    select as (args: unknown, ctx: unknown, nestedQuery: unknown) => {} | null
                  )(args, ctx, nestedQuery);

                  // A falsy selection means the field selects nothing from the parent row.
                  return selected ? { select: selected } : null;
                }
              : select,
        },
      };
    }

    return fieldConfig;
  }

  override wrapResolve(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object, unknown>,
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> {
    if (fieldConfig.kind !== 'PrismaObject' || !fieldConfig.extensions?.pothosPrismaSelect) {
      return resolver;
    }

    const parentConfig = this.buildCache.getTypeConfig(fieldConfig.parentType);
    const loadedCheck = fieldConfig.extensions?.pothosPrismaLoaded as
      | ((val: unknown, info: GraphQLResolveInfo) => boolean)
      | undefined;
    const loaderCache = parentConfig.extensions?.pothosPrismaLoader as (
      model: unknown,
    ) => ModelLoader;

    const fallback = fieldConfig.extensions?.pothosPrismaFallback as
      | ((query: {}, parent: unknown, args: {}, context: {}, info: {}) => unknown)
      | undefined;

    const parentTypes = new Set([fieldConfig.parentType]);

    if (parentConfig.kind === 'Interface' || parentConfig.kind === 'Object') {
      for (const iface of parentConfig.interfaces) {
        const interfaceConfig = this.buildCache.getTypeConfig(iface, 'Interface');
        if (interfaceConfig.extensions?.pothosPrismaModel) {
          parentTypes.add(interfaceConfig.name);
        }
      }
    }

    return (parent, args, context, info) => {
      let mapping = getLoaderMapping(context, info.path, info.parentType.name);

      if (!mapping) {
        for (const parentType of parentTypes) {
          mapping = getLoaderMapping(context, info.path, parentType);
          if (mapping) {
            break;
          }
        }
      }

      if ((!loadedCheck || loadedCheck(parent, info)) && mapping) {
        setLoaderMappings(context, info, mapping.nested);

        return resolver(parent, args, context, info);
      }

      if (fallback) {
        return fallback(
          queryFromInfo({
            context,
            info,
            skipDeferredFragments: this.builder.options.prisma.skipDeferredFragments,
          }),
          parent,
          args,
          context,
          info,
        );
      }

      return loaderCache(context)
        .loadSelection(info, parent as object)
        .then((result) => resolver(result, args, context, info));
    };
  }
}

SchemaBuilder.registerPlugin(pluginName, PothosPrismaPlugin, {
  v3: (options) => ({
    prisma: {
      ...options.prisma,
      filterConnectionTotalCount: options.prisma?.filterConnectionTotalCount ?? false,
    },
  }),
});
