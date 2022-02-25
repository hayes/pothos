import './global-types';
import './field-builder';
import './schema-builder';
import { GraphQLFieldResolver } from 'graphql';
import SchemaBuilder, {
  BasePlugin,
  BuildCache,
  PothosOutputFieldConfig,
  SchemaTypes,
} from '@pothos/core';
import { ModelLoader } from './model-loader';
import { getLoaderMapping, setLoaderMappings } from './util/loader-map';
import { queryFromInfo, selectionStateFromInfo } from './util/map-query';

export * from './types';

const pluginName = 'prisma' as const;

export default pluginName;

export class PrismaPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  constructor(cache: BuildCache<Types>) {
    super(cache, pluginName);
  }

  override onOutputFieldConfig(
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): PothosOutputFieldConfig<Types> | null {
    if (fieldConfig.kind === 'PrismaObject') {
      return {
        ...fieldConfig,
        extensions: {
          ...fieldConfig.extensions,
          pothosPrismaSelect: fieldConfig.pothosOptions.select,
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
    const loadedCheck = fieldConfig.extensions.pothosPrismaLoaded as
      | undefined
      | ((val: unknown) => boolean);
    const loaderCache = parentConfig.extensions?.pothosPrismaLoader as (
      model: unknown,
    ) => ModelLoader;

    const fallback = fieldConfig.extensions.pothosPrismaFallback as
      | undefined
      | ((query: {}, parent: unknown, args: {}, context: {}, info: {}) => unknown);

    return (parent, args, context, info) => {
      const mapping = getLoaderMapping(context, info.path);

      if ((!loadedCheck || loadedCheck(parent)) && mapping) {
        setLoaderMappings(context, info.path, mapping);

        return resolver(parent, args, context, info);
      }

      if (fallback) {
        return fallback(queryFromInfo(context, info), parent, args, context, info);
      }

      const selectionState = selectionStateFromInfo(context, info);

      return loaderCache(parent)
        .loadSelection(selectionState, context)
        .then((result) => {
          const mappings = selectionState.mappings[info.path.key];

          if (mappings) {
            setLoaderMappings(context, info.path, mappings.mappings);
          }

          return resolver(result, args, context, info);
        });
    };
  }
}

SchemaBuilder.registerPlugin(pluginName, PrismaPlugin);
