import './global-types.js';
import './field-builder.js';
import './schema-builder.js';
import SchemaBuilder, {
  BasePlugin,
  isThenable,
  type MaybePromise,
  type PothosOutputFieldConfig,
  type SchemaTypes,
  unwrapOutputFieldType,
} from '@pothos/core';
import type DataLoader from 'dataloader';
import type { GraphQLFieldResolver } from 'graphql';

export * from './refs/index.js';
export * from './types.js';
export * from './util.js';

const pluginName = 'dataloader';

// Resolvers for list fields are allowed to return any Iterable, but the loader wrappers below need
// to be able to map over the results, so non-array iterables are consumed into an array first.
// Anything that isn't iterable is passed through unchanged so it fails the way it did before.
function toResolvedList(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'object' && value !== null && Symbol.iterator in value) {
    return [...(value as Iterable<unknown>)];
  }

  return value as unknown[];
}

export class PothosDataloaderPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  override wrapResolve(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object>,
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> {
    const isList = fieldConfig.type.kind === 'List';

    const config = this.buildCache.getTypeConfig(unwrapOutputFieldType(fieldConfig.type));

    const getDataloader = config.extensions?.getDataloader as (
      context: object,
    ) => DataLoader<unknown, unknown>;

    if (!getDataloader) {
      return resolver;
    }

    const cacheResolved = config.extensions?.cacheResolved as
      | ((val: unknown) => string)
      | undefined;

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
          if (cacheResolved) {
            const key = cacheResolved(idOrResult);
            loader.prime(key, idOrResult);
          }
          return idOrResult;
      }
    }

    if (isList) {
      return (parent, args, context, info) => {
        const loader = getDataloader(context);
        const promiseOrResults = resolver(parent, args, context, info) as MaybePromise<
          Iterable<unknown> | null | undefined
        >;

        const loadList = (results: Iterable<unknown> | null | undefined) =>
          results == null ? results : toResolvedList(results).map((item) => loadIfID(item, loader));

        if (isThenable(promiseOrResults)) {
          return promiseOrResults.then(loadList);
        }

        return loadList(promiseOrResults);
      };
    }

    return (parent, args, context, info) =>
      loadIfID(resolver(parent, args, context, info), getDataloader(context));
  }
}

SchemaBuilder.registerPlugin(pluginName, PothosDataloaderPlugin);

export default pluginName;
