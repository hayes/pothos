import './global-types';
import './schema-builder';
import './field-builder';
import { GraphQLFieldResolver, GraphQLResolveInfo } from 'graphql';
import SchemaBuilder, {
  BasePlugin,
  BuildCache,
  PothosOutputFieldConfig,
  PothosSchemaError,
  PothosTypeConfig,
  SchemaTypes,
} from '@pothos/core';
import { ModelLoader } from './model-loader';
import { PrismaObjectFieldBuilder as InternalPrismaObjectFieldBuilder } from './prisma-field-builder';
import { PrismaModelTypes } from './types';
import { formatPrismaCursor, parsePrismaCursor } from './util/cursors';
import { getModel, getRefFromModel } from './util/datamodel';
import { getLoaderMapping, setLoaderMappings } from './util/loader-map';
import { queryFromInfo } from './util/map-query';

export { prismaConnectionHelpers } from './connection-helpers';
export { PrismaInterfaceRef } from './interface-ref';
export { PrismaNodeRef } from './node-ref';
export { prismaModelKey, PrismaObjectRef } from './object-ref';
export * from './types';

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
  NeedsResolve extends boolean,
  Shape extends object = Model['Shape'],
>(
  typename: string,
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
) => PothosSchemaTypes.PrismaObjectFieldBuilder<Types, Model, NeedsResolve, Shape>;

export class PothosPrismaPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  constructor(cache: BuildCache<Types>) {
    super(cache, pluginName);
  }

  override onTypeConfig(typeConfig: PothosTypeConfig): PothosTypeConfig {
    if (typeConfig.kind !== 'Object' && typeConfig.kind !== 'Interface') {
      return typeConfig;
    }

    let model = typeConfig.extensions?.pothosPrismaModel as string | undefined;

    typeConfig.interfaces.forEach((iface) => {
      const interfaceModel = this.buildCache.getTypeConfig(iface, 'Interface').extensions
        ?.pothosPrismaModel as string | undefined;

      if (interfaceModel) {
        if (model && model !== interfaceModel) {
          throw new PothosSchemaError(
            `PrismaObjects must be based on the same prisma model as any PrismaInterfaces they extend. ${typeConfig.name} uses ${model} and ${iface.name} uses ${interfaceModel}`,
          );
        }

        model = interfaceModel;
      }
    });

    return {
      ...typeConfig,
      extensions: {
        ...typeConfig.extensions,
        pothosPrismaModel: model,
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
                ) => ({
                  select: (select as (args: unknown, ctx: unknown, nestedQuery: unknown) => {})(
                    args,
                    ctx,
                    nestedQuery,
                  ),
                })
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
      parentConfig.interfaces.forEach((iface) => {
        const interfaceConfig = this.buildCache.getTypeConfig(iface, 'Interface');
        if (interfaceConfig.extensions?.pothosPrismaModel) {
          parentTypes.add(interfaceConfig.name);
        }
      });
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
        setLoaderMappings(context, info, mapping);

        return resolver(parent, args, context, info);
      }

      if (fallback) {
        return fallback(queryFromInfo({ context, info }), parent, args, context, info);
      }

      return loaderCache(context)
        .loadSelection(info, parent as object)
        .then((result) => resolver(result, args, context, info));
    };
  }
}

SchemaBuilder.registerPlugin(pluginName, PothosPrismaPlugin);
