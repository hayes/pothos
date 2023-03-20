import './global-types';
import './schema-builder';
import { GraphQLFieldResolver } from 'graphql';
import SchemaBuilder, {
  BasePlugin,
  BuildCache,
  PothosOutputFieldConfig,
  SchemaTypes,
} from '@pothos/core';
import { PrismaObjectFieldBuilder as InternalPrismaObjectFieldBuilder } from './field-builder';
import { ModelLoader } from './model-loader';
import { PrismaModelTypes } from './types';
import { formatPrismaCursor, parsePrismaCursor } from './util/cursors';
import { getModel, getRefFromModel } from './util/datamodel';
import { getLoaderMapping, setLoaderMappings } from './util/loader-map';
import { queryFromInfo, selectionStateFromInfo } from './util/map-query';

export { prismaConnectionHelpers } from './connection-helpers';
export { PrismaNodeRef } from './node-ref';
export { PrismaObjectRef } from './object-ref';
export * from './types';

const pluginName = 'prisma' as const;

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
  name: string,
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
) => PothosSchemaTypes.PrismaObjectFieldBuilder<Types, Model, NeedsResolve, Shape>;

export class PrismaPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  constructor(cache: BuildCache<Types>) {
    super(cache, pluginName);
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
                  nestedQuery: (query: unknown, path?: string[]) => never,
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

    const parentConfig = this.buildCache.getTypeConfig(fieldConfig.parentType, 'Object');
    const loadedCheck = fieldConfig.extensions?.pothosPrismaLoaded as
      | undefined
      | ((val: unknown) => boolean);
    const loaderCache = parentConfig.extensions?.pothosPrismaLoader as (
      model: unknown,
    ) => ModelLoader;

    const fallback = fieldConfig.extensions?.pothosPrismaFallback as
      | undefined
      | ((query: {}, parent: unknown, args: {}, context: {}, info: {}) => unknown);

    return (parent, args, context, info) => {
      const mapping = getLoaderMapping(context, info.path, info.parentType.name);

      if ((!loadedCheck || loadedCheck(parent)) && mapping) {
        setLoaderMappings(context, info, mapping);

        return resolver(parent, args, context, info);
      }

      if (fallback) {
        return fallback(queryFromInfo({ context, info }), parent, args, context, info);
      }

      const selectionState = selectionStateFromInfo(context, info);

      return loaderCache(parent)
        .loadSelection(selectionState, context)
        .then((result) => {
          const mappings = selectionState.mappings[info.path.key];

          if (mappings) {
            setLoaderMappings(context, info, mappings.mappings);
          }

          return resolver(result, args, context, info);
        });
    };
  }
}

SchemaBuilder.registerPlugin(pluginName, PrismaPlugin);
