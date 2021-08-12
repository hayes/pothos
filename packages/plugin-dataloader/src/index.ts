import './global-types.js';
import './field-builder.js';
import './schema-builder.js';
import DataLoader from 'dataloader';
import { GraphQLFieldResolver } from 'graphql';
import SchemaBuilder, {
  BasePlugin,
  GiraphQLOutputFieldConfig,
  isThenable,
  MaybePromise,
  SchemaTypes,
} from '@giraphql/core';

export * from './types.js';
export * from './util.js';

const pluginName = 'dataloader' as const;
export class GiraphQLDataloaderPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  override wrapResolve(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object>,
    fieldConfig: GiraphQLOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> {
    const isList = fieldConfig.type.kind === 'List';
    const type = fieldConfig.type.kind === 'List' ? fieldConfig.type.type : fieldConfig.type;

    const getDataloader = this.buildCache.getTypeConfig(type.ref).giraphqlOptions.extensions
      ?.getDataloader as (context: object) => DataLoader<unknown, unknown>;

    if (!getDataloader) {
      return resolver;
    }

    function loadIfID(idOrResult: unknown, loader: DataLoader<unknown, unknown>): unknown {
      if (idOrResult == null) {
        return idOrResult;
      }

      if (isThenable(idOrResult)) {
        return idOrResult.then((result) => loadIfID(result, loader));
      }

      switch (typeof idOrResult) {
        case 'number':
        case 'bigint':
        case 'string':
          return loader.load(idOrResult);
        default:
          return idOrResult;
      }
    }

    if (isList) {
      return (parent, args, context, info) => {
        const loader = getDataloader(context);
        const promiseOrResults = resolver(parent, args, context, info) as MaybePromise<
          unknown[] | null | undefined
        >;

        if (isThenable(promiseOrResults)) {
          return promiseOrResults.then((results) => results?.map((item) => loadIfID(item, loader)));
        }

        return promiseOrResults?.map((item) => loadIfID(item, loader));
      };
    }

    return (parent, args, context, info) =>
      loadIfID(resolver(parent, args, context, info), getDataloader(context));
  }
}

SchemaBuilder.registerPlugin(pluginName, GiraphQLDataloaderPlugin);

export default pluginName;
