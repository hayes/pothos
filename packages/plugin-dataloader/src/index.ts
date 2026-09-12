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

    // Follows the list shape the field was configured with, so that ids nested inside lists of
    // lists are loaded rather than being treated as already loaded results.
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

      // An Error in a list position is how graphql-js is told to null that position and report the
      // error at its own path, so it is passed through rather than being treated as a nested list.
      if (result instanceof Error) {
        return result;
      }

      if (isThenable(result)) {
        return result.then((results) => loadResults(results, loader, depth));
      }

      if (!isIterableList(result)) {
        // The schema says this position is a list but the value isn't one. Hand it back unchanged
        // so graphql-js reports that at this position, rather than throwing out of the whole field.
        return result;
      }

      const items = Array.isArray(result) ? result : [...result];

      return items.map((item) =>
        // Only positions that are themselves lists can fail while being consumed. Leaf positions
        // are never iterated, so they keep propagating the way they always have.
        depth > 1 ? loadNestedList(item, loader, depth - 1) : loadIfID(item, loader),
      );
    }

    // Contains a failure at the list position it happened in, so graphql-js keeps its usual
    // nullability boundary and the sibling rows survive.
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
