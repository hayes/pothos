import './global-types';
import './field-builder';
import './schema-builder';
import DataLoader from 'dataloader';
import { GraphQLFieldResolver } from 'graphql';
import SchemaBuilder, {
  BasePlugin,
  GiraphQLOutputFieldConfig,
  isThenable,
  MaybePromise,
  ObjectRef,
  SchemaTypes,
} from '@giraphql/core';
import { DataloaderObjectTypeOptions } from './types';

export * from './refs';
export * from './types';
export * from './util';

const pluginName = 'dataloader' as const;
export class GiraphQLDataloaderPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  override wrapResolve(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object>,
    fieldConfig: GiraphQLOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> {
    const isList = fieldConfig.type.kind === 'List';
    const type = fieldConfig.type.kind === 'List' ? fieldConfig.type.type : fieldConfig.type;

    const options = this.buildCache.getTypeConfig(type.ref)
      .giraphqlOptions as DataloaderObjectTypeOptions<
      Types,
      unknown,
      bigint | number | string,
      [],
      ObjectRef<unknown>,
      unknown
    >;

    const getDataloader = options.extensions?.getDataloader as (
      context: object,
    ) => DataLoader<unknown, unknown>;

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
          if (options.cacheResolved !== undefined) {
            const key = options.cacheResolved(idOrResult);
            loader.prime(key, idOrResult);
          }
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
