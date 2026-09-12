import './global-types.js';
import './field-builder.js';
import './schema-builder.js';
import SchemaBuilder, {
  BasePlugin,
  isThenable,
  type PothosOutputFieldConfig,
  type SchemaTypes,
  unwrapOutputFieldType,
} from '@pothos/core';
import type DataLoader from 'dataloader';
import type { GraphQLFieldResolver } from 'graphql';
import { isIterableList } from './list-utils.js';

export * from './refs/index.js';
export * from './types.js';
export * from './util.js';

const pluginName = 'dataloader';

export class PothosDataloaderPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  override wrapResolve(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object>,
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> {
    let listDepth = 0;
    for (let type = fieldConfig.type; type.kind === 'List'; type = type.type) {
      listDepth += 1;
    }

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

    function loadResults(
      result: unknown,
      loader: DataLoader<unknown, unknown>,
      depth: number,
    ): unknown {
      if (depth === 0) {
        return loadIfID(result, loader);
      }

      if (result == null) {
        return result;
      }

      // An Error in a list position is how graphql-js is told to null that position.
      if (result instanceof Error) {
        return result;
      }

      if (isThenable(result)) {
        return result.then((results) => loadResults(results, loader, depth));
      }

      if (!isIterableList(result)) {
        return result;
      }

      const items = Array.isArray(result) ? result : [...result];

      return items.map((item) =>
        depth > 1 ? loadNestedList(item, loader, depth - 1) : loadIfID(item, loader),
      );
    }

    function loadNestedList(
      result: unknown,
      loader: DataLoader<unknown, unknown>,
      depth: number,
    ): unknown {
      try {
        return loadResults(result, loader, depth);
      } catch (error) {
        return error instanceof Error ? error : new Error(String(error));
      }
    }

    return (parent, args, context, info) =>
      loadResults(resolver(parent, args, context, info), getDataloader(context), listDepth);
  }
}

SchemaBuilder.registerPlugin(pluginName, PothosDataloaderPlugin);

export default pluginName;
